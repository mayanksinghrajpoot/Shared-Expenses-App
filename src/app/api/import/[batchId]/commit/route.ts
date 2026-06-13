import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { parseCsvContent, resolveMemberName, parseCsvDate, isMemberActiveOnDate } from '@/lib/import/engine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { csvText } = await req.json();

    if (!csvText) {
      return NextResponse.json({ error: 'Missing CSV text for committing' }, { status: 400 });
    }

    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        anomalies: true,
      }
    });

    if (!batch) {
      return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });
    }

    if (batch.status === 'completed') {
      return NextResponse.json({ error: 'Batch already committed' }, { status: 400 });
    }

    const report = parseCsvContent(csvText, batch.filename);

    // Get all users to map IDs
    const users = await prisma.user.findMany();
    const userMap = new Map<string, string>(); // name -> id
    users.forEach(u => userMap.set(u.name.toLowerCase(), u.id));

    // Retrieve active members list of the group
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId: batch.groupId }
    });

    const commitReport = await prisma.$transaction(async (tx) => {
      let createdExpensesCount = 0;
      let createdSettlementsCount = 0;

      for (const pe of report.expenses) {
        // Find if this row had any anomaly
        const rowAnomaly = batch.anomalies.find(a => a.csvRowNumber === pe.csvRowNumber);

        // Resolution decisions
        if (rowAnomaly) {
          if (rowAnomaly.reviewStatus === 'rejected') {
            // User rejected this row, skip it!
            continue;
          }
          
          if (rowAnomaly.reviewStatus === 'pending' && rowAnomaly.severity === 'error') {
            // Strict check: pending error rows are skipped
            continue;
          }
        }

        // Check if it's a settlement
        if (pe.isSettlement && pe.settlementDetails) {
          const fromId = userMap.get(pe.settlementDetails.from.toLowerCase());
          const toId = userMap.get(pe.settlementDetails.to.toLowerCase());

          if (fromId && toId) {
            await tx.settlement.create({
              data: {
                groupId: batch.groupId,
                fromUserId: fromId,
                toUserId: toId,
                amount: pe.settlementDetails.amount,
                currency: pe.currency,
                settlementDate: pe.date,
                importBatchId: batch.id,
                notes: `Imported settlement: ${pe.description}`,
              }
            });
            createdSettlementsCount++;
            continue;
          }
        }

        // Regular Expense Creation
        const paidById = userMap.get(pe.paidByName.toLowerCase());
        if (!paidById) continue;

        // Verify splits participants exist and map to IDs
        const finalSplitsData: { userId: string; amount: number; amountInr: number }[] = [];
        
        for (const s of pe.splits) {
          const uId = userMap.get(s.userName.toLowerCase());
          if (uId) {
            // If there's an inactive member timeline anomaly, check if it was rejected or adjusted.
            // If it's Meera after March 31, and she is in the split, but membership check says inactive,
            // we exclude her if she's inactive, unless the user manually approved it (but we default to excluding).
            const isActive = isMemberActiveOnDate(s.userName, pe.date);
            const userApproved = rowAnomaly && rowAnomaly.reviewStatus === 'approved';
            
            // Exclude inactive members unless approved manually
            if (!isActive && !userApproved) {
              continue;
            }

            finalSplitsData.push({
              userId: uId,
              amount: s.amount,
              amountInr: s.amountInr
            });
          }
        }

        // If splits are now empty (due to exclusion), skip
        if (finalSplitsData.length === 0) continue;

        // Re-adjust split shares if some members were excluded (to keep sum equal to total)
        let totalSplitSumInr = finalSplitsData.reduce((sum, s) => sum + s.amountInr, 0);
        if (pe.splitType === 'equal' && Math.abs(totalSplitSumInr - pe.amountInr) > 1.0) {
          const shareInr = pe.amountInr / finalSplitsData.length;
          const shareOriginal = pe.amount / finalSplitsData.length;
          finalSplitsData.forEach(fs => {
            fs.amount = parseFloat(shareOriginal.toFixed(2));
            fs.amountInr = parseFloat(shareInr.toFixed(2));
          });
        }

        const exp = await tx.expense.create({
          data: {
            groupId: batch.groupId,
            paidById,
            description: pe.description,
            amount: pe.amount,
            currency: pe.currency,
            exchangeRate: pe.exchangeRate,
            amountInr: pe.amountInr,
            expenseDate: pe.date,
            splitType: pe.splitType,
            category: 'Imported',
            status: 'active',
            importBatchId: batch.id,
            csvRowNumber: pe.csvRowNumber,
          }
        });

        // Save splits
        for (const fsd of finalSplitsData) {
          await tx.expenseSplit.create({
            data: {
              expenseId: exp.id,
              userId: fsd.userId,
              amount: fsd.amount,
              amountInr: fsd.amountInr
            }
          });
        }

        createdExpensesCount++;
      }

      // Update batch status
      const updatedBatch = await tx.importBatch.update({
        where: { id: batchId },
        data: {
          status: 'completed',
          importedRows: createdExpensesCount + createdSettlementsCount,
          completedAt: new Date(),
        }
      });

      return {
        batchId: updatedBatch.id,
        expensesCount: createdExpensesCount,
        settlementsCount: createdSettlementsCount,
      };
    });

    return NextResponse.json({
      message: 'Batch committed successfully',
      result: commitReport
    });
  } catch (error) {
    console.error('Commit import batch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
