import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { anomalyId, reviewStatus, resolutionDetails } = await req.json();

    if (!anomalyId || !reviewStatus) {
      return NextResponse.json({ error: 'Missing anomalyId or reviewStatus' }, { status: 400 });
    }

    const updatedAnomaly = await prisma.importAnomaly.update({
      where: {
        id: anomalyId,
        importBatchId: batchId,
      },
      data: {
        reviewStatus, // approved | rejected
        resolutionDetails,
        reviewedById: session.userId,
        reviewedAt: new Date(),
      }
    });

    return NextResponse.json({ anomaly: updatedAnomaly });
  } catch (error) {
    console.error('Update import anomaly error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
