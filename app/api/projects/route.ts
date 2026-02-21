import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import Papa from 'papaparse';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          entries: true,
        },
      },
      entries: {
        select: {
          status: true,
        },
      },
    },
  });

  const projectsWithStats = projects.map((project) => {
    const total = project._count.entries;
    const completed = project.entries.filter((e) => e.status === 'COMPLETED').length;
    const skipped = project.entries.filter((e) => e.status === 'SKIPPED').length;
    const failed = project.entries.filter((e) => e.status === 'FAILED').length;
    const pending = total - completed - skipped - failed;

    return {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      stats: { total, completed, skipped, failed, pending },
    };
  });

  return NextResponse.json({ projects: projectsWithStats });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const file = formData.get('file') as File;

    if (!name || !file) {
      return NextResponse.json({ error: 'Name and file required' }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<any>(text, { header: true, skipEmptyLines: true });

    const project = await prisma.project.create({
      data: {
        name,
        createdBy: user.userId,
      },
    });

    const entries = parsed.data
      .filter((row: any) => row.name && row.image_link)
      .map((row: any) => ({
        projectId: project.id,
        medicineName: row.name || row.Name || '',
        originalImageUrl: row.image_link || '',
        status: 'PENDING' as const,
      }));

    await prisma.medicineEntry.createMany({
      data: entries,
    });

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Project creation error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
