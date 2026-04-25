import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { redis } from '@/lib/redis';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const start = parseInt(searchParams.get('start') || '0');

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  // Check cache first (24 hour TTL)
  const cacheKey = `images:${query}:${start}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for query: ${query} (start: ${start})`);
      return NextResponse.json(JSON.parse(cached as string));
    }
  } catch (error) {
    console.error('Redis cache read error:', error);
  }

  const dataForSeoLogin = process.env.DATAFORSEO_LOGIN;
  const dataForSeoPassword = process.env.DATAFORSEO_PASSWORD;

  // Try DataForSEO if credentials are available
  if (dataForSeoLogin && dataForSeoPassword) {
    try {
      const auth = Buffer.from(`${dataForSeoLogin}:${dataForSeoPassword}`).toString('base64');
      
      const postData = [{
        keyword: query,
        location_code: 2356, // India
        language_code: 'en',
        device: 'desktop',
        os: 'windows',
        depth: Math.min(start + 100, 700), // Max 700 results
      }];

      const response = await axios.post(
        'https://api.dataforseo.com/v3/serp/google/images/live/advanced',
        postData,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.tasks && response.data.tasks[0]?.result) {
        const items = response.data.tasks[0].result[0]?.items || [];
        
        // Slice based on pagination
        const paginatedItems = items.slice(start, start + 30);
        
        const images = paginatedItems
          .filter((item: any) => item.type === 'images_search')
          .map((item: any) => ({
            url: item.source_url || item.encoded_url,
            thumbnail: item.thumbnail || item.source_url,
            title: item.title || query,
          }));

        console.log(`Found ${images.length} images for query: ${query} (start: ${start}) via DataForSEO India`);

        const result = {
          images,
          hasMore: items.length > start + 30,
          nextStart: start + 30,
        };

        // Cache the result for 24 hours
        try {
          await redis.setex(cacheKey, 86400, JSON.stringify(result));
        } catch (error) {
          console.error('Redis cache write error:', error);
        }

        return NextResponse.json(result);
      }
    } catch (error: any) {
      console.error('DataForSEO error:', error?.response?.data || error.message);
      // Fall through to Unsplash fallback
    }
  }

  // Fallback to Unsplash if no DataForSEO credentials or if it fails
  try {
    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: query,
        per_page: 30,
        page: Math.floor(start / 30) + 1,
        client_id: unsplashKey || 'demo',
      },
    });

    const images = (response.data.results || []).map((item: any) => ({
      url: item.urls.regular,
      thumbnail: item.urls.thumb,
      title: item.alt_description || query,
    }));

    console.log(`Found ${images.length} images for query: ${query} (start: ${start}) via Unsplash fallback`);

    const result = {
      images,
      hasMore: images.length >= 30,
      nextStart: start + 30,
    };

    // Cache fallback results for 1 hour
    try {
      await redis.setex(cacheKey, 3600, JSON.stringify(result));
    } catch (error) {
      console.error('Redis cache write error:', error);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Image search error:', error);
    return NextResponse.json({ error: 'Failed to fetch images', images: [], hasMore: false }, { status: 200 });
  }
}
