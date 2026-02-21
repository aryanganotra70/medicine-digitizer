import { NextRequest, NextResponse } from 'next/server';
import { processImage } from '@/lib/imageProcessing';
import { uploadToR2 } from '@/lib/r2';

export async function POST(request: NextRequest) {
  try {
    const { imageUrls, medicineName } = await request.json();

    const results = await Promise.all(
      imageUrls.map(async (url: string, index: number) => {
        try {
          const processedBuffer = await processImage(url);
          const key = `${medicineName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}_${index}.webp`;
          const r2Url = await uploadToR2(processedBuffer, key);
          
          return { originalUrl: url, r2Url, success: true };
        } catch (error) {
          return { originalUrl: url, r2Url: '', success: false };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
