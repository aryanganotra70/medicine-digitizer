import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { MedicineRow } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<any>(text, { header: true, skipEmptyLines: true });
    
    const medicines: MedicineRow[] = parsed.data.map((row: any) => ({
      name: row.name || row.Name || '',
      imageUrls: row.image_link ? [row.image_link.trim()] : [],
    })).filter((m: MedicineRow) => m.name);

    return NextResponse.json({ medicines });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to parse CSV' }, { status: 500 });
  }
}
