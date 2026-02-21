import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const start = parseInt(searchParams.get('start') || '0');

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&hl=en&start=${start}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    const images: any[] = [];
    
    // Extract all image URLs from the HTML using multiple patterns
    const urlPatterns = [
      /"(https?:\/\/[^"]*\.(?:jpg|jpeg|png|webp|gif)[^"]*)"/gi,
      /\["(https?:\/\/encrypted-tbn\d\.gstatic\.com\/images[^"]+)"/gi,
    ];

    // Blacklist of URLs to filter out
    const blacklist = [
      'ssl.gstatic.com/gb/images',
      'gstatic.com/images/branding',
      'gstatic.com/images/icons',
      '/logo',
      '/icon',
      'data:image',
    ];

    urlPatterns.forEach(pattern => {
      const matches = response.data.matchAll(pattern);
      for (const match of matches) {
        const url = match[1];
        
        // Filter out invalid images
        const isBlacklisted = blacklist.some(bl => url.includes(bl));
        const isDuplicate = images.find(img => img.url === url);
        const isTooShort = url.length < 50; // Very short URLs are usually icons
        
        if (url && url.startsWith('http') && !isBlacklisted && !isDuplicate && !isTooShort) {
          images.push({
            url: url,
            thumbnail: url,
            title: query,
          });
        }
      }
    });

    console.log(`Found ${images.length} images for query: ${query} (start: ${start})`);

    // Return up to 30 images per request
    const uniqueImages = images.slice(0, 30);

    return NextResponse.json({ 
      images: uniqueImages,
      hasMore: images.length >= 30,
      nextStart: start + 30,
    });
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json({ error: 'Failed to fetch images', images: [], hasMore: false }, { status: 200 });
  }
}
