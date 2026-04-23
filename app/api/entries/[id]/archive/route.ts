import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { unlockEntry } from '@/lib/redis';
import { uploadToR2 } from '@/lib/r2';
import { addWatermark } from '@/lib/watermark';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Get the entry to get medicine name
    const entry = await prisma.medicineEntry.findUnique({
      where: { id },
      select: { medicineName: true },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Read medicineimage.png from project root
    const imagePath = path.join(process.cwd(), 'medicineimage.png');
    const imageBuffer = await fs.readFile(imagePath);

    // Process the image (resize to standard size)
    const processed = await sharp(imageBuffer)
      .resize(600, 600, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
      .webp({ quality: 90 })
      .toBuffer();

    // Add watermark
    const watermarked = await addWatermark(processed);

    // Upload to R2
    const key = `${entry.medicineName.replace(/[^a-z0-9]/gi, '_')}_archived_${Date.now()}.webp`;
    const r2Url = await uploadToR2(watermarked, key);

    // Update entry status to ARCHIVED with processed image
    await prisma.medicineEntry.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        digitizedBy: user.userId,
        processedImages: [r2Url],
        updatedAt: new Date(),
      },
    });

    // Release the Redis lock
    await unlockEntry(id);

    return NextResponse.json({ success: true, message: 'Entry archived', processedImage: r2Url });
  } catch (error) {
    console.error('Failed to archive entry:', error);
    return NextResponse.json({ error: 'Failed to archive entry' }, { status: 500 });
  }
}
