import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        anomalies: {
          orderBy: {
            csvRowNumber: 'asc',
          }
        }
      }
    });

    if (!batch) {
      return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });
    }

    return NextResponse.json({ batch });
  } catch (error) {
    console.error('Fetch import batch details error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
