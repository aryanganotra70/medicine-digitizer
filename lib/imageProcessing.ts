import sharp from 'sharp';
import axios from 'axios';

export async function processImage(imageUrl: string): Promise<Buffer> {
  // Download image with timeout
  const response = await axios.get(imageUrl, { 
    responseType: 'arraybuffer',
    timeout: 10000, // 10 second timeout
    maxContentLength: 10 * 1024 * 1024, // 10MB max
  });
  const inputBuffer = Buffer.from(response.data);

  // Remove background and process with optimized settings
  const processed = await sharp(inputBuffer)
    .resize(600, 600, { 
      fit: 'contain', 
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: true, // Don't upscale small images
    })
    .toFormat('png')
    .toBuffer();

  // Create white background and composite with optimized quality
  const final = await sharp({
    create: {
      width: 600,
      height: 600,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: processed, gravity: 'center' }])
    .webp({ quality: 85, effort: 4 }) // Reduced effort from 6 for faster processing
    .toBuffer();

  return final;
}
