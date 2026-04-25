import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { processImage } from '@/lib/imageProcessing';
import { uploadToR2 } from '@/lib/r2';
import { unlockEntry } from '@/lib/redis';
import { addWatermark } from '@/lib/watermark';
import path from 'path';

export const maxDuration = 300; // 5 minutes for serverless function

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
      select: { id: true, medicineName: true }, // Only select needed fields
    });

    if (!entry) return;

    const processedUrls: string[] = [];

    // Process images in parallel batches of 3 for better performance
    const batchSize = 3;
    for (let i = 0; i < selectedImages.length; i += batchSize) {
      const batch = selectedImages.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (imageUrl, batchIndex) => {
          const index = i + batchIndex;
          console.log(`Processing image ${index + 1}/${selectedImages.length} for entry ${entryId}`);
          
          // Step 1: Download and resize image
          const processedBuffer = await processImage(imageUrl);
          
          // Step 2: Add watermark
          const logoPath = path.join(process.cwd(), 'medsright.png');
          const watermarkedBuffer = await addWatermark(processedBuffer, logoPath);
          
          // Step 3: Upload to R2
          const key = `${entry.medicineName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}_${index}.webp`;
          const r2Url = await uploadToR2(watermarkedBuffer, key);
          
          console.log(`✓ Successfully processed image ${index + 1}`);
          return r2Url;
        })
      );

      // Collect successful results
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          processedUrls.push(result.value);
        } else {
          console.error('Image processing error:', result.reason);
        }
      });
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
