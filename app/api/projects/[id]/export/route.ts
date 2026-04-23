import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import Papa from 'papaparse';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Get all COMPLETED and ARCHIVED entries
    const entries = await prisma.medicineEntry.findMany({
      where: {
        projectId: id,
        status: {
          in: ['COMPLETED', 'ARCHIVED'],
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No completed or archived entries to export' }, { status: 404 });
    }

    // Find the maximum number of images across all entries
    const maxImages = Math.max(...entries.map(e => e.processedImages.length));

    // Create column headers
    const columns = ['medicine_name', 'original_link'];
    for (let i = 1; i <= maxImages; i++) {
      columns.push(`image_link${i}`);
    }

    // Transform data for CSV
    const csvData = entries.map((entry) => {
      const row: any = {
        medicine_name: entry.medicineName,
        original_link: entry.originalImageUrl,
      };

      // Add each processed image as a separate column
      for (let i = 0; i < maxImages; i++) {
        const columnName = `image_link${i + 1}`;
        row[columnName] = entry.processedImages[i] || '';
      }

      return row;
    });

    // Generate CSV with explicit columns
    const csv = Papa.unparse(csvData, {
      columns: columns,
      header: true,
    });

    // Get project name for filename
    const project = await prisma.project.findUnique({
      where: { id },
      select: { name: true },
    });

    const filename = `${project?.name.replace(/[^a-z0-9]/gi, '_') || 'project'}_export_${Date.now()}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
