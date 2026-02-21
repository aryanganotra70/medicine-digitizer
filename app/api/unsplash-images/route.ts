import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 });
  }

  try {
    // Using Unsplash's free API (no key needed for basic search)
    const response = await axios.get(
      `https://api.unsplash.com/search/photos`,
      {
        params: {
          query: query,
          per_page: 20,
          client_id: process.env.UNSPLASH_ACCESS_KEY || 'demo', // You can get a free key from unsplash.com/developers
        },
      }
    );

    const images = response.data.results?.map((item: any) => ({
      url: item.urls.regular,
      thumbnail: item.urls.thumb,
      title: item.alt_description || query,
    })) || [];

    return NextResponse.json({ images });
  } catch (error) {
    console.error('Unsplash error:', error);
    return NextResponse.json({ error: 'Failed to fetch images', images: [] }, { status: 200 });
  }
}
