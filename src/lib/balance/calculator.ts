import { PrismaClient } from '@prisma/client';

export interface MemberBalance {
  userId: string;
  name: string;
  email: string;
  totalPaid: number;   // In INR
  totalOwed: number;   // In INR
  netBalance: number;  // totalPaid - totalOwed
}

export interface LedgerEntry {
  expenseId: string;
  date: Date;
  description: string;
  payerName: string;
  totalAmount: number; // In original currency
  currency: string;
  amountInr: number;
  userShareInr: number;
  userPaidInr: number;
  netImpactInr: number; // userPaidInr - userShareInr
  runningBalanceInr: number;
}

export interface UserLedger {
  userId: string;
  name: string;
  netBalance: number;
  entries: LedgerEntry[];
}

export async function calculateGroupBalances(prisma: PrismaClient, groupId: string): Promise<MemberBalance[]> {
  // Get all members of the group
  const memberships = await prisma.groupMembership.findMany({
    where: { groupId },
    include: { user: true },
  });

  const members = memberships.map(m => m.user);
  const balances: MemberBalance[] = [];

  for (const user of members) {
    // Calculate total paid by this user in this group
    const paidAggregation = await prisma.expense.aggregate({
      where: {
        groupId,
        paidById: user.id,
        status: 'active',
      },
      _sum: {
        amountInr: true,
      },
    });

    // Calculate total owed by this user in this group (sum of their splits)
    const owedAggregation = await prisma.expenseSplit.aggregate({
      where: {
        userId: user.id,
        expense: {
          groupId,
          status: 'active',
        },
      },
      _sum: {
        amountInr: true,
      },
    });

    // Substract settlements recorded
    // Money sent as settlement is a payment (increases paid/decreases debt)
    const settlementsSent = await prisma.settlement.aggregate({
      where: {
        groupId,
        fromUserId: user.id,
      },
      _sum: {
        amount: true, // Settlements are in INR
      },
    });

    const settlementsRcvd = await prisma.settlement.aggregate({
      where: {
        groupId,
        toUserId: user.id,
      },
      _sum: {
        amount: true,
      },
    });

    const totalPaid = (paidAggregation._sum.amountInr || 0) + (settlementsSent._sum.amount || 0);
    const totalOwed = (owedAggregation._sum.amountInr || 0) + (settlementsRcvd._sum.amount || 0);
    const netBalance = parseFloat((totalPaid - totalOwed).toFixed(2));

    balances.push({
      userId: user.id,
      name: user.name,
      email: user.email,
      totalPaid: parseFloat(totalPaid.toFixed(2)),
      totalOwed: parseFloat(totalOwed.toFixed(2)),
      netBalance,
    });
  }

  return balances;
}

export async function generateUserLedger(
  prisma: PrismaClient,
  groupId: string,
  userId: string
): Promise<UserLedger | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  // Get all active expenses in the group, sorted by date
  const expenses = await prisma.expense.findMany({
    where: {
      groupId,
      status: 'active',
    },
    include: {
      paidBy: true,
      splits: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      expenseDate: 'asc',
    },
  });

  // Get all settlements in the group, sorted by date
  const settlements = await prisma.settlement.findMany({
    where: {
      groupId,
    },
    include: {
      fromUser: true,
      toUser: true,
    },
    orderBy: {
      settlementDate: 'asc',
    },
  });

  // Interleave expenses and settlements by date
  type TimelineItem = 
    | { type: 'expense'; date: Date; data: typeof expenses[0] }
    | { type: 'settlement'; date: Date; data: typeof settlements[0] };

  const timeline: TimelineItem[] = [
    ...expenses.map(e => ({ type: 'expense' as const, date: e.expenseDate, data: e })),
    ...settlements.map(s => ({ type: 'settlement' as const, date: s.settlementDate, data: s })),
  ];

  timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

  const entries: LedgerEntry[] = [];
  let runningBalance = 0;

  for (const item of timeline) {
    if (item.type === 'expense') {
      const e = item.data;
      const userSplit = e.splits.find(s => s.userId === userId);
      
      const userPaidInr = e.paidById === userId ? e.amountInr : 0;
      const userShareInr = userSplit ? userSplit.amountInr : 0;

      // If the user neither paid nor was in the split, it doesn't affect their ledger
      if (userPaidInr === 0 && userShareInr === 0) continue;

      const netImpactInr = userPaidInr - userShareInr;
      runningBalance += netImpactInr;

      entries.push({
        expenseId: e.id,
        date: e.expenseDate,
        description: e.description,
        payerName: e.paidBy.name,
        totalAmount: e.amount,
        currency: e.currency,
        amountInr: e.amountInr,
        userShareInr: parseFloat(userShareInr.toFixed(2)),
        userPaidInr: parseFloat(userPaidInr.toFixed(2)),
        netImpactInr: parseFloat(netImpactInr.toFixed(2)),
        runningBalanceInr: parseFloat(runningBalance.toFixed(2)),
      });
    } else {
      const s = item.data;
      const isSender = s.fromUserId === userId;
      const isReceiver = s.toUserId === userId;

      if (!isSender && !isReceiver) continue;

      const userPaidInr = isSender ? s.amount : 0;
      const userShareInr = isReceiver ? s.amount : 0;
      const netImpactInr = userPaidInr - userShareInr; // If I paid them, my credit increases. If they paid me, my credit decreases.
      runningBalance += netImpactInr;

      entries.push({
        expenseId: s.id,
        date: s.settlementDate,
        description: isSender ? `Settlement to ${s.toUser.name}` : `Settlement from ${s.fromUser.name}`,
        payerName: s.fromUser.name,
        totalAmount: s.amount,
        currency: s.currency,
        amountInr: s.amount,
        userShareInr: parseFloat(userShareInr.toFixed(2)),
        userPaidInr: parseFloat(userPaidInr.toFixed(2)),
        netImpactInr: parseFloat(netImpactInr.toFixed(2)),
        runningBalanceInr: parseFloat(runningBalance.toFixed(2)),
      });
    }
  }

  return {
    userId,
    name: user.name,
    netBalance: parseFloat(runningBalance.toFixed(2)),
    entries,
  };
}
