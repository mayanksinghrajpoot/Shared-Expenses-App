import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settlements = await prisma.settlement.findMany({
      where: {
        groupId: id,
      },
      include: {
        fromUser: {
          select: { id: true, name: true, email: true }
        },
        toUser: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: {
        settlementDate: 'desc',
      }
    });

    return NextResponse.json({ settlements });
  } catch (error) {
    console.error('Fetch settlements error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { fromUserId, toUserId, amount, currency, settlementDate, notes } = await req.json();

    if (!fromUserId || !toUserId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const settlement = await prisma.settlement.create({
      data: {
        groupId: id,
        fromUserId,
        toUserId,
        amount: parseFloat(amount),
        currency: currency || 'INR',
        settlementDate: settlementDate ? new Date(settlementDate) : new Date(),
        notes: notes || 'Direct settlement payment',
      },
      include: {
        fromUser: {
          select: { id: true, name: true }
        },
        toUser: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({ settlement }, { status: 201 });
  } catch (error) {
    console.error('Record settlement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
