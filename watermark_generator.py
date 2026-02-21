"""
Product Image Watermark Generator
Adds grayscale logo watermark to product images without hiding details
"""

from PIL import Image, ImageEnhance
import os

def add_watermark(product_image_path, logo_path, output_path, 
                  watermark_opacity=0.3, watermark_scale=0.3):
    """
    Add a grayscale watermark to a product image
    
    Args:
        product_image_path: Path to the product image
        logo_path: Path to the logo image
        output_path: Path where the watermarked image will be saved
        watermark_opacity: Opacity of watermark (0.0 to 1.0, default 0.3)
        watermark_scale: Scale of watermark relative to product image width (default 0.3)
    """
    # Open images
    product = Image.open(product_image_path).convert('RGBA')
    logo = Image.open(logo_path).convert('RGBA')
    
    # Convert logo to grayscale while preserving alpha channel
    logo_gray = logo.convert('LA').convert('RGBA')
    
    # Calculate watermark size (based on product image width)
    watermark_width = int(product.width * watermark_scale)
    aspect_ratio = logo.height / logo.width
    watermark_height = int(watermark_width * aspect_ratio)
    
    # Resize logo
    logo_resized = logo_gray.resize((watermark_width, watermark_height), 
                                    Image.Resampling.LANCZOS)
    
    # Adjust opacity
    alpha = logo_resized.split()[3]
    alpha = ImageEnhance.Brightness(alpha).enhance(watermark_opacity)
    logo_resized.putalpha(alpha)
    
    # Calculate position (vertically centered, horizontally centered)
    x_position = (product.width - watermark_width) // 2
    y_position = (product.height - watermark_height) // 2
    
    # Create a transparent layer the same size as product image
    watermark_layer = Image.new('RGBA', product.size, (0, 0, 0, 0))
    watermark_layer.paste(logo_resized, (x_position, y_position), logo_resized)
    
    # Composite the watermark onto the product image
    watermarked = Image.alpha_composite(product, watermark_layer)
    
    # Determine output format and quality settings
    output_lower = output_path.lower()
    
    if output_lower.endswith('.webp'):
        # Save as WebP with compression
        watermarked.save(output_path, 'WEBP', quality=85, method=6)
        print(f"✓ Watermarked WebP image saved to: {output_path}")
    elif output_lower.endswith(('.jpg', '.jpeg')):
        # Convert to RGB for JPEG
        watermarked = watermarked.convert('RGB')
        watermarked.save(output_path, 'JPEG', quality=90, optimize=True)
        print(f"✓ Watermarked JPEG image saved to: {output_path}")
    else:
        # Save as PNG with compression
        watermarked.save(output_path, 'PNG', optimize=True, compress_level=6)
        print(f"✓ Watermarked PNG image saved to: {output_path}")
    
    return output_path


def batch_watermark(product_folder, logo_path, output_folder, 
                    watermark_opacity=0.3, watermark_scale=0.3):
    """
    Apply watermark to all images in a folder
    
    Args:
        product_folder: Folder containing product images
        logo_path: Path to the logo image
        output_folder: Folder where watermarked images will be saved
        watermark_opacity: Opacity of watermark (0.0 to 1.0)
        watermark_scale: Scale of watermark relative to product image width
    """
    # Create output folder if it doesn't exist
    os.makedirs(output_folder, exist_ok=True)
    
    # Supported image formats
    supported_formats = ('.png', '.jpg', '.jpeg', '.webp', '.bmp')
    
    # Process all images in the folder
    processed_count = 0
    for filename in os.listdir(product_folder):
        if filename.lower().endswith(supported_formats):
            product_path = os.path.join(product_folder, filename)
            output_path = os.path.join(output_folder, f"watermarked_{filename}")
            
            try:
                add_watermark(product_path, logo_path, output_path, 
                            watermark_opacity, watermark_scale)
                processed_count += 1
            except Exception as e:
                print(f"✗ Error processing {filename}: {str(e)}")
    
    print(f"\n{'='*50}")
    print(f"Processed {processed_count} images successfully!")
    print(f"{'='*50}")


# Example usage
if __name__ == "__main__":
    # Single image watermarking example
    logo_path = 'medsright.png'  # This is your watermark logo
    product_path = "image1.png"  # This is your product image
    output_path = "./watermarked_product.png"
    
    print("Adding watermark to product image...")
    print(f"Logo: {logo_path}")
    print(f"Product: {product_path}")
    print(f"Output: {output_path}\n")
    
    add_watermark(
        product_image_path=product_path,
        logo_path=logo_path,
        output_path=output_path,
        watermark_opacity=0.3,  # Adjust: 0.1 (very light) to 0.5 (more visible)
        watermark_scale=0.8     # Adjust: 0.2 (small) to 0.5 (large)
    )
    
    # Batch processing example (uncomment to use)
    """
    batch_watermark(
        product_folder="path/to/product/images",
        logo_path=logo_path,
        output_folder="path/to/output/folder",
        watermark_opacity=0.3,
        watermark_scale=0.3
    )
    """
