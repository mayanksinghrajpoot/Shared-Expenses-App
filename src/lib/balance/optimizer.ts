export interface OptimizedTransfer {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number; // In INR
}

interface MemberBalanceInput {
  userId: string;
  name: string;
  netBalance: number;
}

export function optimizeSettlements(balances: MemberBalanceInput[]): OptimizedTransfer[] {
  // Separate into debtors (negative balance) and creditors (positive balance)
  const debtors = balances
    .filter(b => b.netBalance < -0.01)
    .map(b => ({ ...b, balance: Math.abs(b.netBalance) }))
    .sort((a, b) => b.balance - a.balance); // Descending debt

  const creditors = balances
    .filter(b => b.netBalance > 0.01)
    .map(b => ({ ...b, balance: b.netBalance }))
    .sort((a, b) => b.balance - a.balance); // Descending credit

  const transfers: OptimizedTransfer[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    // Find the minimum of the two balances
    const amountToTransfer = Math.min(debtor.balance, creditor.balance);
    
    if (amountToTransfer > 0.01) {
      transfers.push({
        fromUserId: debtor.userId,
        fromUserName: debtor.name,
        toUserId: creditor.userId,
        toUserName: creditor.name,
        amount: parseFloat(amountToTransfer.toFixed(2)),
      });
    }

    // Update their balances
    debtor.balance -= amountToTransfer;
    creditor.balance -= amountToTransfer;

    // Move pointers if balance is cleared (with threshold check for floating point)
    if (debtor.balance < 0.01) {
      dIdx++;
    }
    if (creditor.balance < 0.01) {
      cIdx++;
    }
  }

  return transfers;
}
