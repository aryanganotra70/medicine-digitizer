import sharp from 'sharp';
import axios from 'axios';

export async function processImage(imageUrl: string): Promise<Buffer> {
  // Download image
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const inputBuffer = Buffer.from(response.data);

  // Remove background and process
  const processed = await sharp(inputBuffer)
    .resize(600, 600, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFormat('png')
    .toBuffer();

  // Create white background and composite
  const final = await sharp({
    create: {
      width: 600,
      height: 600,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: processed, gravity: 'center' }])
    .webp({ quality: 90 })
    .toBuffer();

  return final;
}
