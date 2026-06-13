'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: string;
  name: string;
  email: string;
}

interface GroupMembership {
  id: string;
  userId: string;
  joinedAt: string;
  leftAt: string | null;
  role: string;
  user: User;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  defaultCurrency: string;
  memberships: GroupMembership[];
}

interface ExpenseSplit {
  id: string;
  userId: string;
  amount: number;
  amountInr: number;
  user: {
    id: string;
    name: string;
  };
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  amountInr: number;
  expenseDate: string;
  splitType: string;
  category: string;
  paidById: string;
  csvRowNumber: number | null;
  paidBy: {
    id: string;
    name: string;
  };
  splits: ExpenseSplit[];
}

interface Settlement {
  id: string;
  amount: number;
  currency: string;
  settlementDate: string;
  notes: string | null;
  fromUser: { id: string; name: string };
  toUser: { id: string; name: string };
}

interface MemberBalance {
  userId: string;
  name: string;
  email: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

interface OptimizedTransfer {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

interface LedgerEntry {
  expenseId: string;
  date: string;
  description: string;
  payerName: string;
  totalAmount: number;
  currency: string;
  amountInr: number;
  userShareInr: number;
  userPaidInr: number;
  netImpactInr: number;
  runningBalanceInr: number;
}

interface UserLedger {
  userId: string;
  name: string;
  netBalance: number;
  entries: LedgerEntry[];
}

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params);
  const router = useRouter();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'settlements' | 'members' | 'import'>('expenses');

  // Core Data States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [suggestedSettlements, setSuggestedSettlements] = useState<OptimizedTransfer[]>([]);
  
  // Rohan's Ledger States
  const [selectedLedgerUserId, setSelectedLedgerUserId] = useState<string>('');
  const [selectedLedger, setSelectedLedger] = useState<UserLedger | null>(null);

  // Loading & Modals
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddSettlement, setShowAddSettlement] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [settlementError, setSettlementError] = useState('');

  // Manual Expense Form State
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCurrency, setExpCurrency] = useState('INR');
  const [expRate, setExpRate] = useState('83.5');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expPayerId, setExpPayerId] = useState('');
  const [expSplitType, setExpSplitType] = useState('equal');
  const [expSplits, setExpSplits] = useState<{ [userId: string]: { amount?: string; shares?: string } }>({});

  // Manual Settlement Form State
  const [setFromId, setSetFromId] = useState('');
  const [setToId, setSetToId] = useState('');
  const [setAmount, setSetAmount] = useState('');
  const [setNotes, setSetNotes] = useState('');

  // Import State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [committing, setCommitting] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');

  // Timeline Member Edit States
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editJoinedAt, setEditJoinedAt] = useState('');
  const [editLeftAt, setEditLeftAt] = useState('');
  const [editRole, setEditRole] = useState('member');

  // Load Group Data
  const loadData = async () => {
    try {
      // Current User
      const userRes = await fetch('/api/auth/me');
      if (!userRes.ok) {
        router.push('/login');
        return;
      }
      const userData = await userRes.json();
      setCurrentUser(userData.user);

      // Group Details
      const groupRes = await fetch(`/api/groups/${groupId}`);
      if (!groupRes.ok) {
        router.push('/dashboard');
        return;
      }
      const groupData = await groupRes.json();
      setGroup(groupData.group);
      
      // Default forms setup
      if (groupData.group.memberships.length > 0) {
        setExpPayerId(userData.user.id);
        setSetFromId(userData.user.id);
        
        const otherMember = groupData.group.memberships.find((m: any) => m.userId !== userData.user.id);
        if (otherMember) setSetToId(otherMember.userId);
      }

      // Expenses
      const expRes = await fetch(`/api/groups/${groupId}/expenses`);
      if (expRes.ok) {
        const expData = await expRes.json();
        setExpenses(expData.expenses);
      }

      // Settlements
      const setRes = await fetch(`/api/groups/${groupId}/settlements`);
      if (setRes.ok) {
        const setData = await setRes.json();
        setSettlements(setData.settlements);
      }

      // Balances
      const balRes = await fetch(`/api/groups/${groupId}/balances`);
      if (balRes.ok) {
        const balData = await balRes.json();
        setBalances(balData.balances);
        setSuggestedSettlements(balData.suggestedSettlements);
      }
    } catch (err) {
      console.error('Error loading group data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [groupId, router]);

  // Load Rohan's Ledger Detail
  useEffect(() => {
    if (!selectedLedgerUserId) {
      setSelectedLedger(null);
      return;
    }

    const fetchLedger = async () => {
      try {
        const res = await fetch(`/api/groups/${groupId}/balances?userId=${selectedLedgerUserId}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedLedger(data.ledger);
        }
      } catch (err) {
        console.error('Error fetching ledger:', err);
      }
    };

    fetchLedger();
  }, [selectedLedgerUserId, groupId, expenses, settlements]);

  // Handle Manual Expense Add
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');

    const amt = parseFloat(expAmount);
    if (!expDesc.trim() || isNaN(amt) || amt <= 0 || !expPayerId) {
      setExpenseError('Please fill out all required fields with valid values');
      return;
    }

    // Build splits array
    const splitsPayload = [];
    if (expSplitType !== 'equal') {
      const activeMembers = group?.memberships || [];
      for (const m of activeMembers) {
        const userConf = expSplits[m.userId];
        if (expSplitType === 'exact') {
          const splitAmt = parseFloat(userConf?.amount || '0');
          if (splitAmt > 0) {
            splitsPayload.push({ userId: m.userId, amount: splitAmt });
          }
        } else if (expSplitType === 'percentage' || expSplitType === 'shares') {
          const shareVal = parseFloat(userConf?.shares || '0');
          if (shareVal > 0) {
            splitsPayload.push({ userId: m.userId, shares: shareVal });
          }
        }
      }

      if (splitsPayload.length === 0) {
        setExpenseError('Please specify split amounts or shares for participants');
        return;
      }
    }

    try {
      const res = await fetch(`/api/groups/${groupId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: expDesc,
          amount: amt,
          currency: expCurrency,
          exchangeRate: parseFloat(expRate),
          expenseDate: expDate,
          splitType: expSplitType,
          paidById: expPayerId,
          splits: splitsPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save expense');

      setShowAddExpense(false);
      setExpDesc('');
      setExpAmount('');
      setExpSplitType('equal');
      setExpSplits({});
      loadData();
    } catch (err: any) {
      setExpenseError(err.message || 'Error saving expense');
    }
  };

  // Handle Manual Settlement Add
  const handleAddSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettlementError('');

    const amt = parseFloat(setAmount);
    if (!setFromId || !setToId || isNaN(amt) || amt <= 0) {
      setSettlementError('Please fill out all fields correctly');
      return;
    }

    if (setFromId === setToId) {
      setSettlementError('Cannot record settlement to oneself');
      return;
    }

    try {
      const res = await fetch(`/api/groups/${groupId}/settlements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUserId: setFromId,
          toUserId: setToId,
          amount: amt,
          notes: setNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record settlement');

      setShowAddSettlement(false);
      setSetAmount('');
      setSetNotes('');
      loadData();
    } catch (err: any) {
      setSettlementError(err.message || 'Error recording settlement');
    }
  };

  // Handle CSV Import Upload
  const handleImportUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');
    setImportReport(null);

    if (!uploadFile) {
      setImportError('Please select a CSV file first');
      return;
    }

    setImporting(true);

    try {
      const rawText = await uploadFile.text();
      setCsvRawText(rawText);

      const formData = new FormData();
      formData.append('file', uploadFile);

      const res = await fetch(`/api/groups/${groupId}/import`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import upload failed');

      setImportReport(data.report);
    } catch (err: any) {
      setImportError(err.message || 'Error uploading CSV');
    } finally {
      setImporting(false);
    }
  };

  // Update Anomaly Review Choice (Approve/Reject)
  const handleReviewAnomaly = async (anomalyId: string, choice: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`/api/import/${importReport.batchId}/anomalies`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomalyId,
          reviewStatus: choice,
        }),
      });

      if (res.ok) {
        // Update local report state
        const updatedAnomalies = importReport.anomalies.map((a: any) =>
          a.id === anomalyId ? { ...a, reviewStatus: choice } : a
        );
        setImportReport({ ...importReport, anomalies: updatedAnomalies });
      }
    } catch (err) {
      console.error('Error reviewing anomaly:', err);
    }
  };

  // Commit Import Report Data
  const handleCommitImport = async () => {
    setCommitting(true);
    try {
      const res = await fetch(`/api/import/${importReport.batchId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: csvRawText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to commit import');

      setImportReport(null);
      setUploadFile(null);
      setCsvRawText('');
      setActiveTab('expenses');
      loadData();
    } catch (err: any) {
      setImportError(err.message || 'Error committing import');
    } finally {
      setCommitting(false);
    }
  };

  // Update Member Joined/Left Timeline
  const handleUpdateMembership = async (userId: string) => {
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          members: [
            {
              userId,
              joinedAt: editJoinedAt || undefined,
              leftAt: editLeftAt ? editLeftAt : null,
              role: editRole,
            }
          ]
        }),
      });

      if (res.ok) {
        setEditingUserId(null);
        loadData();
      }
    } catch (err) {
      console.error('Error updating membership:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading Group Details...</span>
        </div>
      </div>
    );
  }

  // Find users for dropdowns
  const members = group?.memberships.map(m => m.user) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-xs font-semibold px-3 py-1.5 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
              ← Dashboard
            </Link>
            <span className="font-bold text-base text-slate-500">/</span>
            <span className="font-bold text-slate-200">{group?.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Signed in as:</span>
            <span className="text-xs font-bold text-emerald-400">{currentUser?.name}</span>
          </div>
        </div>
      </header>

      {/* Main Hub Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        
        {/* Info Banner Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/30 border border-slate-900/60 p-5 rounded-2xl">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Group Name</span>
            <span className="font-bold text-slate-200 truncate">{group?.name}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Active Members</span>
            <span className="font-bold text-emerald-400">{group?.memberships.length}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Total Expenses</span>
            <span className="font-bold text-slate-200">
              ₹{expenses.reduce((sum, e) => sum + e.amountInr, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Settled Payments</span>
            <span className="font-bold text-teal-400">
              ₹{settlements.reduce((sum, s) => sum + s.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Tab Navigator */}
        <div className="border-b border-slate-900 flex gap-2">
          {(['expenses', 'balances', 'settlements', 'members', 'import'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 -mb-[2px] transition-all ${
                activeTab === tab
                  ? 'border-emerald-400 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab === 'import' ? 'CSV Import' : tab === 'balances' ? 'Balances (Rohan)' : tab}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 min-h-[300px]">
          
          {/* EXPENSES TAB */}
          {activeTab === 'expenses' && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-200">Shared Expenses Ledger</h2>
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 text-xs font-bold rounded-xl hover:brightness-110 shadow shadow-teal-500/5 transition-all hover:scale-[1.01]"
                >
                  + Add Expense
                </button>
              </div>

              {/* Expenses Table */}
              <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden shadow">
                {expenses.length > 0 ? (
                  <div className="divide-y divide-slate-900/60">
                    {expenses.map((e) => (
                      <div key={e.id} className="p-4 flex flex-col gap-3 hover:bg-slate-900/30 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-200">{e.description}</span>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>Paid by <strong className="text-slate-300">{e.paidBy.name}</strong></span>
                              <span>•</span>
                              <span>{new Date(e.expenseDate).toLocaleDateString()}</span>
                              <span>•</span>
                              <span className="capitalize px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-400">
                                {e.splitType} Split
                              </span>
                              {e.csvRowNumber && (
                                <>
                                  <span>•</span>
                                  <span className="text-[10px] text-teal-500">Row #{e.csvRowNumber}</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right flex flex-col gap-1.5">
                            <span className="font-extrabold text-slate-100">
                              {e.currency === 'USD' ? '$' : '₹'}{e.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            {e.currency === 'USD' && (
                              <span className="text-[10px] text-slate-500">
                                Converted: ₹{e.amountInr.toLocaleString(undefined, { minimumFractionDigits: 2 })} (@ {e.exchangeRate})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Splits Subview */}
                        <div className="bg-slate-950/40 border border-slate-900/40 rounded-xl p-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
                          <span className="font-semibold text-slate-500">Splits:</span>
                          {e.splits.map((s) => (
                            <div key={s.id} className="flex gap-1.5">
                              <span className="text-slate-300 font-medium">{s.user.name}:</span>
                              <span>
                                {e.currency === 'USD' ? '$' : '₹'}{s.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center text-xs text-slate-500">
                    No active expenses recorded. Add an expense or import the CSV!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BALANCES TAB (Rohan's drilldown ledger) */}
          {activeTab === 'balances' && (
            <div className="flex flex-col gap-6">
              
              {/* Balance Summary Grid */}
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold text-slate-200">Current Net Balances</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {balances.map((b) => (
                    <div
                      key={b.userId}
                      onClick={() => setSelectedLedgerUserId(b.userId)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                        selectedLedgerUserId === b.userId
                          ? 'border-emerald-500 bg-slate-900/60 shadow-md shadow-emerald-500/5'
                          : 'border-slate-900 bg-slate-900/20 hover:border-slate-800'
                      }`}
                    >
                      <div className="font-bold text-slate-200 text-sm truncate">{b.name}</div>
                      <div className="text-[10px] text-slate-500">Net Impact</div>
                      <div className={`font-extrabold text-base ${b.netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {b.netBalance >= 0 ? '+' : ''}₹{b.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[9px] text-slate-500 flex justify-between pt-1 border-t border-slate-900/60 mt-1">
                        <span>Paid: ₹{Math.round(b.totalPaid)}</span>
                        <span>Owed: ₹{Math.round(b.totalOwed)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rohan's Ledger Detail drill down */}
              <div className="border-t border-slate-900 pt-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-200">
                    {selectedLedger ? `Ledger Detail: ${selectedLedger.name}` : 'Select a member above to inspect ledger math'}
                  </h3>
                  {selectedLedger && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${selectedLedger.netBalance >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      Total Balance: {selectedLedger.netBalance >= 0 ? '+' : ''}₹{selectedLedger.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>

                {selectedLedger ? (
                  <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden shadow">
                    {selectedLedger.entries.length > 0 ? (
                      <table className="w-full border-collapse text-xs text-left">
                        <thead>
                          <tr className="bg-slate-950/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                            <th className="p-3">Date</th>
                            <th className="p-3">Description</th>
                            <th className="p-3">Payer</th>
                            <th className="p-3 text-right">Expense Cost</th>
                            <th className="p-3 text-right">Your Share</th>
                            <th className="p-3 text-right">You Paid</th>
                            <th className="p-3 text-right">Net Impact</th>
                            <th className="p-3 text-right bg-slate-950/20">Running Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/60 text-slate-300">
                          {selectedLedger.entries.map((entry, idx) => (
                            <tr key={entry.expenseId + idx} className="hover:bg-slate-900/10 transition-colors">
                              <td className="p-3 text-slate-500">{new Date(entry.date).toLocaleDateString()}</td>
                              <td className="p-3 font-semibold text-slate-200">{entry.description}</td>
                              <td className="p-3 text-slate-400">{entry.payerName}</td>
                              <td className="p-3 text-right">
                                {entry.currency === 'USD' ? '$' : '₹'}{entry.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right text-rose-400/80">
                                -₹{entry.userShareInr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right text-emerald-400/80">
                                {entry.userPaidInr > 0 ? `+₹${entry.userPaidInr.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                              <td className={`p-3 text-right font-medium ${entry.netImpactInr >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {entry.netImpactInr >= 0 ? '+' : ''}₹{entry.netImpactInr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                              <td className={`p-3 text-right font-bold bg-slate-950/10 ${entry.runningBalanceInr >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {entry.runningBalanceInr >= 0 ? '+' : ''}₹{entry.runningBalanceInr.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="py-12 text-center text-slate-500">
                        No transactions recorded for this user yet.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500 border border-dashed border-slate-900 rounded-2xl bg-slate-900/10">
                    Click on a member card above to inspect their exact expense ledger history.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTLEMENTS TAB (Aisha's optimized list) */}
          {activeTab === 'settlements' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Left Column: Aisha's Optimized Payments */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-200">Suggested Optimized Settlements</h2>
                  <button
                    onClick={() => setShowAddSettlement(true)}
                    className="px-3.5 py-1.5 border border-slate-800 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all active:scale-95"
                  >
                    Record Payment
                  </button>
                </div>
                
                <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 flex flex-col gap-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <strong>Aisha&apos;s request resolved:</strong> The ledger has calculated who owes whom. Using the minimum cash flow optimizer, we have reduced the transfers to the absolute minimum required:
                  </p>

                  {suggestedSettlements.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {suggestedSettlements.map((s, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-900 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-rose-400">{s.fromUserName}</span>
                            <span className="text-slate-500 text-xs">pays</span>
                            <span className="font-bold text-emerald-400">{s.toUserName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-slate-100">
                              ₹{s.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <button
                              onClick={() => {
                                setSetFromId(s.fromUserId);
                                setSetToId(s.toUserId);
                                setSetAmount(s.amount.toString());
                                setSetNotes(`Settled debt of ₹${s.amount}`);
                                setShowAddSettlement(true);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-bold text-emerald-400 transition-colors"
                            >
                              Resolve
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-500 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                      ✓ All debts settled! Net balances are balanced.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Settlement History */}
              <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold text-slate-200">Recorded Settlements History</h2>
                <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden shadow">
                  {settlements.length > 0 ? (
                    <div className="divide-y divide-slate-900/60 max-h-[400px] overflow-y-auto">
                      {settlements.map((s) => (
                        <div key={s.id} className="p-4 flex justify-between items-center gap-4 hover:bg-slate-900/30 transition-colors">
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="text-slate-300">
                              <strong className="text-slate-200 font-semibold">{s.fromUser.name}</strong> paid <strong className="text-slate-200 font-semibold">{s.toUser.name}</strong>
                            </span>
                            {s.notes && <span className="text-slate-500 italic text-[11px]">{s.notes}</span>}
                            <span className="text-[10px] text-slate-600">{new Date(s.settlementDate).toLocaleDateString()}</span>
                          </div>
                          <span className="font-extrabold text-sm text-teal-400">
                            ₹{s.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-16 text-center text-xs text-slate-500">
                      No settlements logged. Click &quot;Record Payment&quot; to clear debts.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MEMBERS TIMELINE TAB */}
          {activeTab === 'members' && (
            <div className="flex flex-col gap-5">
              <h2 className="text-xl font-bold text-slate-200">Membership Timeline Tracking</h2>
              <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                <strong>Sam&apos;s request resolved:</strong> Users only participate in splitting expenses dated between their joined and left dates. Inspect and adjust flat mate timelines below:
              </p>

              <div className="bg-slate-900/20 border border-slate-900 rounded-2xl overflow-hidden shadow">
                <div className="divide-y divide-slate-900/60">
                  {group?.memberships.map((m) => {
                    const isEditing = editingUserId === m.userId;
                    
                    return (
                      <div key={m.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/20 transition-all">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-200 text-sm">{m.user.name}</span>
                          <span className="text-xs text-slate-500">{m.user.email}</span>
                        </div>

                        {/* Edit Form Inline */}
                        {isEditing ? (
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] uppercase font-bold text-slate-500">Joined Date</span>
                              <input
                                type="date"
                                value={editJoinedAt}
                                onChange={(e) => setEditJoinedAt(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] uppercase font-bold text-slate-500">Left Date (Optional)</span>
                              <input
                                type="date"
                                value={editLeftAt}
                                onChange={(e) => setEditLeftAt(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] uppercase font-bold text-slate-500">Role</span>
                              <select
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                              >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2 mt-4">
                              <button
                                onClick={() => handleUpdateMembership(m.userId)}
                                className="px-2 py-1 bg-emerald-500 text-slate-950 text-[10px] font-bold rounded hover:brightness-110"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                className="px-2 py-1 border border-slate-855 text-slate-400 text-[10px] font-semibold rounded hover:bg-slate-900"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-6">
                            <div className="text-right flex flex-col gap-1 text-xs text-slate-400">
                              <div>Joined: <strong className="text-slate-300">{new Date(m.joinedAt).toLocaleDateString()}</strong></div>
                              <div>
                                Status:{' '}
                                {m.leftAt ? (
                                  <span className="text-rose-400 font-semibold">Left {new Date(m.leftAt).toLocaleDateString()}</span>
                                ) : (
                                  <span className="text-emerald-400 font-semibold">Still Active</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setEditingUserId(m.userId);
                                setEditJoinedAt(m.joinedAt.split('T')[0]);
                                setEditLeftAt(m.leftAt ? m.leftAt.split('T')[0] : '');
                                setEditRole(m.role);
                              }}
                              className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 rounded-lg text-[10px] text-slate-400 hover:text-slate-200 font-bold transition-all"
                            >
                              Edit Timeline
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* IMPORT CSV TAB */}
          {activeTab === 'import' && (
            <div className="flex flex-col gap-6">
              <h2 className="text-xl font-bold text-slate-200">Import Expenses Spreadsheet</h2>
              <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                Choose `expenses_export.csv` to parse and ingest rows. The app will detect format issues, currency markers, repayments, and duplicates.
              </p>

              {!importReport ? (
                <form onSubmit={handleImportUpload} className="bg-slate-900/20 border border-slate-900 p-8 rounded-2xl flex flex-col items-center gap-4 justify-center">
                  <div className="w-12 h-12 rounded-full bg-slate-955 border border-slate-800 flex items-center justify-center text-lg text-slate-500 font-bold">
                    ⇪
                  </div>

                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-300">Select export file</span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="text-xs border border-slate-855 px-3 py-1.5 bg-slate-950 rounded text-slate-400 cursor-pointer"
                    />
                  </div>

                  {importError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">
                      {importError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={importing || !uploadFile}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 text-xs font-bold rounded-xl hover:brightness-110 shadow transition-all disabled:opacity-50 hover:scale-[1.01]"
                  >
                    {importing ? 'Processing File...' : 'Upload & Parse CSV'}
                  </button>
                </form>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Summary Bar */}
                  <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-900 flex justify-between items-center text-xs flex-wrap gap-4">
                    <div className="flex gap-4">
                      <div>File: <strong className="text-slate-200">{importReport.filename}</strong></div>
                      <div>Total Rows: <strong className="text-slate-200">{importReport.totalRows}</strong></div>
                      <div>Anomalies: <strong className="text-teal-400">{importReport.anomalyCount}</strong></div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setImportReport(null);
                          setUploadFile(null);
                          setCsvRawText('');
                        }}
                        className="px-3 py-1.5 border border-slate-800 hover:bg-slate-955 text-slate-400 hover:text-slate-200 rounded text-xs transition-colors"
                      >
                        Reset Upload
                      </button>
                      <button
                        onClick={handleCommitImport}
                        disabled={committing}
                        className="px-4 py-1.5 bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-bold rounded text-xs transition-all hover:scale-[1.01]"
                      >
                        {committing ? 'Saving Database...' : 'Approve & Commit Database'}
                      </button>
                    </div>
                  </div>

                  {/* Anomaly Reviewer list (Meera's approval flow) */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-base font-bold text-slate-200">
                      Anomalies & Warnings to Verify ({importReport.anomalyCount} Flagged)
                    </h3>
                    
                    {importReport.anomalies.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        {importReport.anomalies.map((a: any) => {
                          const originalData = JSON.parse(a.originalData);
                          
                          return (
                            <div key={a.id} className="p-4 rounded-xl bg-slate-950 border border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-850 transition-all">
                              <div className="flex flex-col gap-1.5 max-w-xl text-xs">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                    Row {a.csvRowNumber}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    a.severity === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                                  }`}>
                                    {a.anomalyType.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-slate-500">•</span>
                                  <span className="text-slate-300 font-semibold">{a.description}</span>
                                </div>
                                
                                <div className="p-2 rounded bg-slate-900/60 font-mono text-[10px] text-slate-500 whitespace-nowrap overflow-x-auto">
                                  {JSON.stringify(originalData)}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleReviewAnomaly(a.id, 'approved')}
                                  className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                                    a.reviewStatus === 'approved'
                                      ? 'bg-emerald-500 text-slate-950'
                                      : 'bg-slate-900 hover:bg-slate-850 text-emerald-400 border border-slate-800/80 hover:border-slate-700'
                                  }`}
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  onClick={() => handleReviewAnomaly(a.id, 'rejected')}
                                  className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                                    a.reviewStatus === 'rejected'
                                      ? 'bg-rose-500 text-slate-950'
                                      : 'bg-slate-900 hover:bg-slate-850 text-rose-400 border border-slate-800/80 hover:border-slate-700'
                                  }`}
                                >
                                  ✕ Skip Row
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-500 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                        ✓ No anomalies detected! Everything looks clean to import.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Manual Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-slate-200">Add Shared Expense</h2>
              <button onClick={() => setShowAddExpense(false)} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>

            {expenseError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">{expenseError}</div>
            )}

            <form onSubmit={handleAddExpense} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Description</label>
                  <input
                    type="text"
                    required
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    placeholder="e.g. Electricity bill"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200 placeholder:text-slate-750"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Paid By</label>
                  <select
                    value={expPayerId}
                    onChange={(e) => setExpPayerId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="1500"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Currency</label>
                  <select
                    value={expCurrency}
                    onChange={(e) => setExpCurrency(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Exchange Rate (USD)</label>
                  <input
                    type="number"
                    step="0.001"
                    disabled={expCurrency === 'INR'}
                    value={expRate}
                    onChange={(e) => setExpRate(e.target.value)}
                    placeholder="83.50"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200 disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Date</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Split Method</label>
                  <select
                    value={expSplitType}
                    onChange={(e) => setExpSplitType(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                  >
                    <option value="equal">Split Equally</option>
                    <option value="exact">Exact Split amounts</option>
                    <option value="percentage">Split by Percentages</option>
                    <option value="shares">Split by Share counts</option>
                  </select>
                </div>
              </div>

              {/* Advanced Splits Config list */}
              {expSplitType !== 'equal' && (
                <div className="bg-slate-950/60 p-4 border border-slate-900 rounded-xl flex flex-col gap-3">
                  <div className="text-xs font-bold text-slate-400">Participant Split configuration</div>
                  {group?.memberships.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between text-xs gap-3">
                      <span className="text-slate-300 font-semibold">{m.user.name}</span>
                      
                      {expSplitType === 'exact' && (
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500">{expCurrency}</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={expSplits[m.userId]?.amount || ''}
                            onChange={(e) => setExpSplits({
                              ...expSplits,
                              [m.userId]: { ...expSplits[m.userId], amount: e.target.value }
                            })}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-right w-24 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      )}

                      {(expSplitType === 'percentage' || expSplitType === 'shares') && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            placeholder="0"
                            value={expSplits[m.userId]?.shares || ''}
                            onChange={(e) => setExpSplits({
                              ...expSplits,
                              [m.userId]: { ...expSplits[m.userId], shares: e.target.value }
                            })}
                            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-right w-20 focus:outline-none focus:border-emerald-500"
                          />
                          <span className="text-slate-500">{expSplitType === 'percentage' ? '%' : 'shares'}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-950 rounded-xl text-xs font-semibold text-slate-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-400 hover:brightness-110 text-slate-950 font-bold rounded-xl text-xs transition-all"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Settlement Modal */}
      {showAddSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-slate-200">Record Settlement Payment</h2>
              <button onClick={() => setShowAddSettlement(false)} className="text-slate-500 hover:text-slate-300">✕</button>
            </div>

            {settlementError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">{settlementError}</div>
            )}

            <form onSubmit={handleAddSettlement} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Payer (Debtor)</label>
                  <select
                    value={setFromId}
                    onChange={(e) => setSetFromId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-400">Recipient (Creditor)</label>
                  <select
                    value={setToId}
                    onChange={(e) => setSetToId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                  >
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Amount (INR)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={setAmount}
                  onChange={(e) => setSetAmount(e.target.value)}
                  placeholder="2300"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-400">Notes (Optional)</label>
                <input
                  type="text"
                  value={setNotes}
                  onChange={(e) => setSetNotes(e.target.value)}
                  placeholder="e.g. Paid Rohan via UPI"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200 placeholder:text-slate-750"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddSettlement(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-955 rounded-xl text-xs font-semibold text-slate-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-emerald-400 to-teal-400 hover:brightness-110 text-slate-950 font-bold rounded-xl text-xs transition-all"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 mt-12">
        <p>© 2026 Spreetail Expenses. Relational SQLite Engine.</p>
      </footer>
    </div>
  );
}
