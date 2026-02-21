import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { processImage } from '@/lib/imageProcessing';
import { uploadToR2 } from '@/lib/r2';
import { unlockEntry } from '@/lib/redis';
import { addWatermark } from '@/lib/watermark';
import path from 'path';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { selectedImages } = await request.json();

  // Process in background (don't await)
  processImagesInBackground(id, selectedImages, user.userId);

  // Return immediately to not block user
  return NextResponse.json({ success: true, processing: true });
}

async function processImagesInBackground(
  entryId: string,
  selectedImages: string[],
  userId: string
) {
  try {
    const entry = await prisma.medicineEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) return;

    const processedUrls: string[] = [];

    for (let i = 0; i < selectedImages.length; i++) {
      try {
        console.log(`Processing image ${i + 1}/${selectedImages.length} for entry ${entryId}`);
        
        // Step 1: Download and resize image
        const processedBuffer = await processImage(selectedImages[i]);
        
        // Step 2: Add watermark
        console.log(`Adding watermark to image ${i + 1}`);
        const logoPath = path.join(process.cwd(), 'medsright.png');
        console.log(`Logo path: ${logoPath}`);
        const watermarkedBuffer = await addWatermark(processedBuffer, logoPath);
        
        // Step 3: Upload to R2
        const key = `${entry.medicineName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}_${i}.webp`;
        console.log(`Uploading to R2: ${key}`);
        const r2Url = await uploadToR2(watermarkedBuffer, key);
        
        processedUrls.push(r2Url);
        console.log(`✓ Successfully processed image ${i + 1}`);
      } catch (error) {
        console.error(`✗ Image processing error for image ${i + 1}:`, error);
      }
    }

    // Release Redis lock
    await unlockEntry(entryId);

    // Update database
    await prisma.medicineEntry.update({
      where: { id: entryId },
      data: {
        status: processedUrls.length > 0 ? 'COMPLETED' : 'FAILED',
        selectedImages,
        processedImages: processedUrls,
        digitizedBy: userId,
        assignedTo: null,
        failureReason: processedUrls.length === 0 ? 'All images failed to process' : null,
      },
    });

    console.log(`✓ Entry ${entryId} completed: ${processedUrls.length}/${selectedImages.length} images processed`);
  } catch (error) {
    console.error('Background processing error:', error);
    
    // Release lock even on failure
    await unlockEntry(entryId);
    
    await prisma.medicineEntry.update({
      where: { id: entryId },
      data: {
        status: 'FAILED',
        failureReason: 'Processing error',
        assignedTo: null,
      },
    });
  }
}
