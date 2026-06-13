import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { calculateGroupBalances, generateUserLedger } from '@/lib/balance/calculator';
import { optimizeSettlements } from '@/lib/balance/optimizer';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userIdForLedger = searchParams.get('userId');

  try {
    // 1. Calculate general balances
    const balances = await calculateGroupBalances(prisma, id);

    // 2. Calculate optimized settlements (Aisha's view)
    const suggestedSettlements = optimizeSettlements(
      balances.map(b => ({
        userId: b.userId,
        name: b.name,
        netBalance: b.netBalance
      }))
    );

    // 3. Generate detailed ledger if requested (Rohan's view)
    let ledger = null;
    if (userIdForLedger) {
      ledger = await generateUserLedger(prisma, id, userIdForLedger);
    }

    return NextResponse.json({
      balances,
      suggestedSettlements,
      ledger
    });
  } catch (error) {
    console.error('Calculate balances error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
