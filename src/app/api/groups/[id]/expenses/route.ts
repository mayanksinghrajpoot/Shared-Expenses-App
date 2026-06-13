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
    const expenses = await prisma.expense.findMany({
      where: {
        groupId: id,
        status: 'active',
      },
      include: {
        paidBy: {
          select: { id: true, name: true, email: true }
        },
        splits: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: {
        expenseDate: 'desc',
      }
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error('Fetch expenses error:', error);
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
    const {
      description,
      amount,
      currency,
      exchangeRate,
      expenseDate,
      splitType,
      category,
      paidById,
      splits // array of { userId, amount, shares }
    } = await req.json();

    if (!description || !amount || !expenseDate || !paidById) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const rate = currency === 'USD' ? (exchangeRate || 83.5) : 1.0;
    const amountInr = parseFloat((amount * rate).toFixed(2));
    const parsedDate = new Date(expenseDate);

    // Get group memberships to validate active participants
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId: id }
    });

    // Check if payer is active
    const payerMembership = memberships.find(m => m.userId === paidById);
    if (!payerMembership) {
      return NextResponse.json({ error: 'Payer is not in the group' }, { status: 400 });
    }
    
    if (payerMembership.leftAt && parsedDate > payerMembership.leftAt) {
      return NextResponse.json({ error: 'Payer was not active on the expense date' }, { status: 400 });
    }

    // Process splits
    let finalSplits: { userId: string; amount: number; amountInr: number; shares?: number }[] = [];

    if (splitType === 'equal') {
      // Find all active members on the expense date
      const activeMembers = memberships.filter(m => {
        const joined = new Date(m.joinedAt);
        const left = m.leftAt ? new Date(m.leftAt) : null;
        return parsedDate >= joined && (!left || parsedDate <= left);
      });

      if (activeMembers.length === 0) {
        return NextResponse.json({ error: 'No active members on this date' }, { status: 400 });
      }

      const shareAmount = amount / activeMembers.length;
      finalSplits = activeMembers.map(m => ({
        userId: m.userId,
        amount: parseFloat(shareAmount.toFixed(2)),
        amountInr: parseFloat((shareAmount * rate).toFixed(2))
      }));
    } else {
      // For exact, percentage, shares, use the provided splits
      if (!splits || !Array.isArray(splits) || splits.length === 0) {
        return NextResponse.json({ error: 'Splits details are required for manual splits' }, { status: 400 });
      }

      // Validate split participants are active
      for (const s of splits) {
        const member = memberships.find(m => m.userId === s.userId);
        if (!member) {
          return NextResponse.json({ error: `Split user is not a member of this group` }, { status: 400 });
        }
        const joined = new Date(member.joinedAt);
        const left = member.leftAt ? new Date(member.leftAt) : null;
        if (parsedDate < joined || (left && parsedDate > left)) {
          return NextResponse.json({ error: `User is not active on the expense date` }, { status: 400 });
        }
      }

      // Parse splits based on splitType
      if (splitType === 'exact') {
        finalSplits = splits.map(s => ({
          userId: s.userId,
          amount: parseFloat(s.amount.toFixed(2)),
          amountInr: parseFloat((s.amount * rate).toFixed(2))
        }));
      } else if (splitType === 'percentage') {
        finalSplits = splits.map(s => {
          const shareAmount = (s.shares / 100) * amount;
          return {
            userId: s.userId,
            amount: parseFloat(shareAmount.toFixed(2)),
            amountInr: parseFloat((shareAmount * rate).toFixed(2)),
            shares: s.shares
          };
        });
      } else if (splitType === 'shares') {
        const totalShares = splits.reduce((sum, s) => sum + (s.shares || 0), 0);
        finalSplits = splits.map(s => {
          const shareAmount = ((s.shares || 0) / totalShares) * amount;
          return {
            userId: s.userId,
            amount: parseFloat(shareAmount.toFixed(2)),
            amountInr: parseFloat((shareAmount * rate).toFixed(2)),
            shares: s.shares
          };
        });
      }
    }

    // Save to Database in transaction
    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          groupId: id,
          paidById,
          description,
          amount,
          currency: currency || 'INR',
          exchangeRate: rate,
          amountInr,
          expenseDate: parsedDate,
          splitType: splitType || 'equal',
          category: category || 'General',
          status: 'active',
        }
      });

      // Create splits
      for (const fs of finalSplits) {
        await tx.expenseSplit.create({
          data: {
            expenseId: exp.id,
            userId: fs.userId,
            amount: fs.amount,
            amountInr: fs.amountInr,
            shares: fs.shares
          }
        });
      }

      return exp;
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error('Create expense error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
