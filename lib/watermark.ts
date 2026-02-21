import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';

export async function addWatermark(
  imageBuffer: Buffer,
  logoPath: string = path.join(process.cwd(), 'medsright.png'),
  opacity: number = 0.3,
  scale: number = 0.8
): Promise<Buffer> {
  // Create temporary files
  const tempId = randomBytes(16).toString('hex');
  const inputPath = path.join('/tmp', `input_${tempId}.png`);
  const outputPath = path.join('/tmp', `output_${tempId}.webp`);

  try {
    // Write input buffer to temp file
    await writeFile(inputPath, imageBuffer);

    // Call Python script
    const result = await runPythonWatermark(inputPath, logoPath, outputPath, opacity, scale);

    // Read output file
    const fs = require('fs').promises;
    const watermarkedBuffer = await fs.readFile(outputPath);

    // Cleanup temp files
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
    ]);

    return watermarkedBuffer;
  } catch (error) {
    // Cleanup on error
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
    ]);
    throw error;
  }
}

function runPythonWatermark(
  inputPath: string,
  logoPath: string,
  outputPath: string,
  opacity: number,
  scale: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const pythonScript = `
from PIL import Image, ImageEnhance
import sys

try:
    def add_watermark(product_image_path, logo_path, output_path, watermark_opacity, watermark_scale):
        product = Image.open(product_image_path).convert('RGBA')
        logo = Image.open(logo_path).convert('RGBA')
        
        logo_gray = logo.convert('LA').convert('RGBA')
        
        watermark_width = int(product.width * watermark_scale)
        aspect_ratio = logo.height / logo.width
        watermark_height = int(watermark_width * aspect_ratio)
        
        logo_resized = logo_gray.resize((watermark_width, watermark_height), Image.Resampling.LANCZOS)
        
        alpha = logo_resized.split()[3]
        alpha = ImageEnhance.Brightness(alpha).enhance(watermark_opacity)
        logo_resized.putalpha(alpha)
        
        x_position = (product.width - watermark_width) // 2
        y_position = (product.height - watermark_height) // 2
        
        watermark_layer = Image.new('RGBA', product.size, (0, 0, 0, 0))
        watermark_layer.paste(logo_resized, (x_position, y_position), logo_resized)
        
        watermarked = Image.alpha_composite(product, watermark_layer)
        watermarked.save(output_path, 'WEBP', quality=85, method=6)
        print("Watermark added successfully", file=sys.stderr)

    add_watermark('${inputPath}', '${logoPath}', '${outputPath}', ${opacity}, ${scale})
except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;

    const python = spawn('python3', ['-c', pythonScript]);

    let stderr = '';

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${stderr}`));
      } else {
        console.log('Watermark process output:', stderr);
        resolve();
      }
    });

    python.on('error', (error) => {
      reject(new Error(`Failed to spawn Python process: ${error.message}`));
    });
  });
}
