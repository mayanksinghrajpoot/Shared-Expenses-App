import Papa from 'papaparse';

export interface RawCsvRow {
  [key: string]: string;
}

export interface Anomaly {
  rowNumber: number;
  type: string; // duplicate, negative_amount, currency_mismatch, inactive_member, unknown_member, settlement_as_expense, etc.
  severity: 'error' | 'warning' | 'info';
  description: string;
  originalData: RawCsvRow;
  actionTaken: string;
  resolutionDetails?: string;
}

export interface ProcessedExpense {
  csvRowNumber: number;
  date: Date;
  description: string;
  amount: number; // original currency
  currency: 'INR' | 'USD';
  exchangeRate: number;
  amountInr: number;
  paidByName: string;
  splitType: 'equal' | 'exact' | 'percentage' | 'shares';
  splits: {
    userName: string;
    amount: number; // original
    amountInr: number;
  }[];
  isSettlement: boolean;
  settlementDetails?: {
    from: string;
    to: string;
    amount: number;
  };
}

export interface ImportReport {
  filename: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  anomalyCount: number;
  anomalies: Anomaly[];
  expenses: ProcessedExpense[];
}

const KNOWN_MEMBERS = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Dev', 'Sam'];

// Membership timelines
// Aisha, Rohan, Priya: Feb 1, 2026 -> present (active)
// Meera: Feb 1, 2026 -> March 31, 2026
// Dev: Feb 1, 2026 -> May 31, 2026 (for trip support)
// Sam: April 15, 2026 -> present
export function isMemberActiveOnDate(name: string, date: Date): boolean {
  const normalized = name.trim().toLowerCase();
  const time = date.getTime();

  const startFeb = new Date('2026-02-01T00:00:00Z').getTime();
  const endMarch = new Date('2026-03-31T23:59:59Z').getTime();
  const endMay = new Date('2026-05-31T23:59:59Z').getTime();
  const startMidApril = new Date('2026-04-15T00:00:00Z').getTime();

  if (normalized === 'aisha' || normalized === 'rohan' || normalized === 'priya') {
    return time >= startFeb;
  }
  if (normalized === 'meera') {
    return time >= startFeb && time <= endMarch;
  }
  if (normalized === 'dev') {
    return time >= startFeb && time <= endMay;
  }
  if (normalized === 'sam') {
    return time >= startMidApril;
  }
  return false; // Unknown member is not active
}

// Map common names/nicknames to clean database names
export function resolveMemberName(name: string): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  if (n === 'aisha' || n === 'aish') return 'Aisha';
  if (n === 'rohan' || n === 'ro') return 'Rohan';
  if (n === 'priya' || n === 'pri') return 'Priya';
  if (n === 'meera' || n === 'meer') return 'Meera';
  if (n === 'dev') return 'Dev';
  if (n === 'sam') return 'Sam';
  return null;
}

// Try parsing dates in multiple formats
export function parseCsvDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();
  
  // Try ISO format first (YYYY-MM-DD)
  let d = new Date(clean);
  if (!isNaN(d.getTime())) return d;

  // Try DD/MM/YYYY or MM/DD/YYYY
  const parts = clean.split(/[/\-]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    // Assume YYYY at the end
    if (p2 > 2000) {
      // Check if p0 is day or month. We will try to parse both.
      // For this flat, they started in Feb. If p1 > 12, then p0 is month.
      // Standard Indian format is DD/MM/YYYY.
      // Let's assume DD/MM/YYYY first.
      const d1 = new Date(Date.UTC(p2, p1 - 1, p0));
      if (!isNaN(d1.getTime()) && p1 <= 12 && p0 <= 31) {
        return d1;
      }
      // Fallback MM/DD/YYYY
      const d2 = new Date(Date.UTC(p2, p0 - 1, p1));
      if (!isNaN(d2.getTime()) && p0 <= 12 && p1 <= 31) {
        return d2;
      }
    }
  }

  return null;
}

// Simple Levenshtein distance for fuzzy duplicate detection
function levenshtein(a: string, b: string): number {
  const tmp = [];
  let i, j, al = a.length, bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  for (i = 0; i <= al; i++) tmp[i] = [i];
  for (j = 0; j <= bl; j++) tmp[0][j] = j;
  for (i = 1; i <= al; i++) {
    for (j = 1; j <= bl; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[al][bl];
}

export function parseCsvContent(csvString: string, filename: string): ImportReport {
  const parsed = Papa.parse<RawCsvRow>(csvString, {
    header: true,
    skipEmptyLines: true,
  });

  const rawRows = parsed.data;
  const anomalies: Anomaly[] = [];
  const processedExpenses: ProcessedExpense[] = [];
  let skippedRows = 0;

  // Track parsed rows for duplicate detection
  // Key: Date_Payer_RoundedAmount
  const seenRows = new Map<string, { index: number; description: string; amount: number; row: RawCsvRow }>();

  // Fetch exchange rate: For USD trip, let's assume a historical rate of ₹83.5 per USD
  // In a real system, we'd fetch this from a live API, but we'll use a fixed historical rate of 83.5 for standard consistency.
  const USD_TO_INR_RATE = 83.5;

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed, header is row 1
    
    // Normalize headers
    const normalizedRow: RawCsvRow = {};
    Object.keys(row).forEach(k => {
      normalizedRow[k.trim().toLowerCase()] = row[k];
    });

    const dateStr = normalizedRow['date'] || normalizedRow['expense date'] || '';
    const descStr = normalizedRow['description'] || normalizedRow['expense'] || normalizedRow['details'] || '';
    const amountStr = normalizedRow['amount'] || normalizedRow['cost'] || '';
    const paidByStr = normalizedRow['paid by'] || normalizedRow['payer'] || '';
    const currencyStr = normalizedRow['currency'] || '';

    // Anomaly 1: Missing Required Fields
    if (!dateStr || !descStr || !amountStr || !paidByStr) {
      anomalies.push({
        rowNumber: rowNum,
        type: 'missing_field',
        severity: 'error',
        description: `Missing required fields: ${[!dateStr && 'date', !descStr && 'description', !amountStr && 'amount', !paidByStr && 'paid_by'].filter(Boolean).join(', ')}`,
        originalData: row,
        actionTaken: 'skipped',
      });
      skippedRows++;
      return;
    }

    // Parse Date
    const expenseDate = parseCsvDate(dateStr);
    if (!expenseDate) {
      anomalies.push({
        rowNumber: rowNum,
        type: 'date_error',
        severity: 'error',
        description: `Cannot parse date format: "${dateStr}"`,
        originalData: row,
        actionTaken: 'skipped',
      });
      skippedRows++;
      return;
    }

    // Anomaly 2: Future Date
    if (expenseDate.getTime() > Date.now()) {
      anomalies.push({
        rowNumber: rowNum,
        type: 'future_date',
        severity: 'warning',
        description: `Expense date is in the future: ${expenseDate.toLocaleDateString()}`,
        originalData: row,
        actionTaken: 'flagged_for_review',
      });
    }

    // Clean and Parse Amount
    let cleanAmountStr = amountStr.trim().replace(/,/g, '');
    let detectedCurrency: 'INR' | 'USD' = 'INR';

    // Currency Detection
    if (cleanAmountStr.startsWith('$') || currencyStr.toUpperCase() === 'USD' || descStr.toLowerCase().includes('usd') || descStr.toLowerCase().includes('dollar')) {
      detectedCurrency = 'USD';
      cleanAmountStr = cleanAmountStr.replace('$', '');
    } else if (cleanAmountStr.startsWith('₹') || currencyStr.toUpperCase() === 'INR') {
      cleanAmountStr = cleanAmountStr.replace('₹', '');
    }

    let rawAmount = parseFloat(cleanAmountStr);
    if (isNaN(rawAmount)) {
      anomalies.push({
        rowNumber: rowNum,
        type: 'format_error',
        severity: 'error',
        description: `Amount is not a valid number: "${amountStr}"`,
        originalData: row,
        actionTaken: 'skipped',
      });
      skippedRows++;
      return;
    }

    // Anomaly 3: Negative Amount (Refund/Correction)
    let isNegative = false;
    if (rawAmount < 0) {
      isNegative = true;
      rawAmount = Math.abs(rawAmount);
      anomalies.push({
        rowNumber: rowNum,
        type: 'negative_amount',
        severity: 'warning',
        description: `Negative amount detected (${amountStr}). Treated as a refund/credit.`,
        originalData: row,
        actionTaken: 'flagged_for_review',
      });
    }

    // Resolve Payer
    const resolvedPayer = resolveMemberName(paidByStr);
    if (!resolvedPayer) {
      anomalies.push({
        rowNumber: rowNum,
        type: 'unknown_member',
        severity: 'error',
        description: `Unknown payer name: "${paidByStr}"`,
        originalData: row,
        actionTaken: 'skipped',
      });
      skippedRows++;
      return;
    }

    // Anomaly 4: Inactive Payer
    if (!isMemberActiveOnDate(resolvedPayer, expenseDate)) {
      anomalies.push({
        rowNumber: rowNum,
        type: 'inactive_member',
        severity: 'warning',
        description: `Payer "${resolvedPayer}" was not active in the group on ${expenseDate.toLocaleDateString()}`,
        originalData: row,
        actionTaken: 'flagged_for_review',
      });
    }

    // Convert Currency
    const exchangeRate = detectedCurrency === 'USD' ? USD_TO_INR_RATE : 1.0;
    const amountInr = parseFloat((rawAmount * exchangeRate).toFixed(2));

    // Anomaly 5: Settlement Logged as Expense
    const lowerDesc = descStr.toLowerCase();
    const isSettlementKeywords = ['settle', 'settlement', 'paid back', 'repayment', 'transfer', 'cleared', 'sent to'];
    let isSettlement = isSettlementKeywords.some(keyword => lowerDesc.includes(keyword));

    // Duplicate detection (Stage 3)
    const amountKey = Math.round(amountInr).toString();
    const duplicateKey = `${expenseDate.toISOString().split('T')[0]}_${resolvedPayer}_${amountKey}`;
    const duplicateMatch = seenRows.get(duplicateKey);

    if (duplicateMatch) {
      // Fuzzy match description to confirm
      const dist = levenshtein(lowerDesc, duplicateMatch.description.toLowerCase());
      const similarity = 1 - dist / Math.max(lowerDesc.length, duplicateMatch.description.length);

      if (similarity > 0.7) {
        anomalies.push({
          rowNumber: rowNum,
          type: 'duplicate',
          severity: 'warning',
          description: `Duplicate entry of row ${duplicateMatch.index} (Same date, payer, amount, and similar description: "${descStr}" vs "${duplicateMatch.description}")`,
          originalData: row,
          actionTaken: 'flagged_for_review',
        });
      } else {
        anomalies.push({
          rowNumber: rowNum,
          type: 'amount_mismatch',
          severity: 'info',
          description: `Row has similar details to row ${duplicateMatch.index} but description differs. Check for duplicates.`,
          originalData: row,
          actionTaken: 'flagged_for_review',
        });
      }
    } else {
      seenRows.set(duplicateKey, { index: rowNum, description: descStr, amount: amountInr, row });
    }

    // Determine Splits
    // Check if columns for each member exist
    const splits: { userName: string; amount: number; amountInr: number }[] = [];
    let splitType: 'equal' | 'exact' | 'percentage' | 'shares' = 'equal';
    
    // Find member-specific columns (e.g. Aisha, Rohan, Priya, Meera, Dev, Sam)
    const memberShares: { [key: string]: number } = {};
    let hasExplicitSplitColumns = false;
    let sumOfSplits = 0;

    KNOWN_MEMBERS.forEach(m => {
      const colVal = normalizedRow[m.toLowerCase()];
      if (colVal !== undefined && colVal.trim() !== '') {
        const shareVal = parseFloat(colVal.trim());
        if (!isNaN(shareVal) && shareVal > 0) {
          memberShares[m] = shareVal;
          hasExplicitSplitColumns = true;
          sumOfSplits += shareVal;
        }
      }
    });

    if (hasExplicitSplitColumns) {
      // If sum equals total amount, it's exact splits.
      // If sum equals 100, it could be percentages.
      // If it's small integers, it could be shares.
      if (Math.abs(sumOfSplits - rawAmount) < 1.0) {
        splitType = 'exact';
      } else if (Math.abs(sumOfSplits - 100) < 0.1) {
        splitType = 'percentage';
      } else {
        splitType = 'shares';
      }

      // Build splits
      Object.keys(memberShares).forEach(m => {
        let shareAmount = 0;
        if (splitType === 'exact') {
          shareAmount = memberShares[m];
        } else if (splitType === 'percentage') {
          shareAmount = (memberShares[m] / 100) * rawAmount;
        } else if (splitType === 'shares') {
          shareAmount = (memberShares[m] / sumOfSplits) * rawAmount;
        }

        splits.push({
          userName: m,
          amount: parseFloat(shareAmount.toFixed(2)),
          amountInr: parseFloat((shareAmount * exchangeRate).toFixed(2)),
        });
      });

      // Anomaly 6: Split Total Discrepancy
      if (splitType === 'exact' && Math.abs(sumOfSplits - rawAmount) > 1.0) {
        anomalies.push({
          rowNumber: rowNum,
          type: 'rounding_error',
          severity: 'warning',
          description: `Sum of exact splits (${sumOfSplits}) does not match total amount (${rawAmount})`,
          originalData: row,
          actionTaken: 'flagged_for_review',
        });
      }
    } else {
      // No explicit columns: Split equally among active members
      splitType = 'equal';
      const activeMembers = KNOWN_MEMBERS.filter(m => isMemberActiveOnDate(m, expenseDate));
      
      if (activeMembers.length === 0) {
        anomalies.push({
          rowNumber: rowNum,
          type: 'inactive_member',
          severity: 'error',
          description: `No active members found on date ${expenseDate.toLocaleDateString()} to split the expense.`,
          originalData: row,
          actionTaken: 'skipped',
        });
        skippedRows++;
        return;
      }

      const shareAmount = rawAmount / activeMembers.length;
      activeMembers.forEach(m => {
        splits.push({
          userName: m,
          amount: parseFloat(shareAmount.toFixed(2)),
          amountInr: parseFloat((shareAmount * exchangeRate).toFixed(2)),
        });
      });
    }

    // Anomaly 7: Inactive Member in Split
    splits.forEach(s => {
      if (!isMemberActiveOnDate(s.userName, expenseDate)) {
        anomalies.push({
          rowNumber: rowNum,
          type: 'inactive_member',
          severity: 'warning',
          description: `Split participant "${s.userName}" was not active on ${expenseDate.toLocaleDateString()}`,
          originalData: row,
          actionTaken: 'flagged_for_review',
        });
      }
    });

    // Check if it is a settlement
    let settlementDetails;
    if (isSettlement) {
      // Typically, a settlement has description like "Aisha paid Rohan" or "Priya to Aisha"
      // Let's try to extract sender and receiver from description
      let sender = resolvedPayer;
      let receiver = '';

      for (const m of KNOWN_MEMBERS) {
        if (m !== sender && lowerDesc.includes(m.toLowerCase())) {
          receiver = m;
          break;
        }
      }

      if (receiver) {
        settlementDetails = {
          from: sender,
          to: receiver,
          amount: rawAmount,
        };
        
        anomalies.push({
          rowNumber: rowNum,
          type: 'settlement_as_expense',
          severity: 'info',
          description: `Settlement logged as expense: ${sender} paid ${receiver} ${detectedCurrency === 'USD' ? '$' : '₹'}${rawAmount}`,
          originalData: row,
          actionTaken: 'flagged_for_review',
        });
      } else {
        // Keyword was matched but receiver wasn't found
        isSettlement = false;
      }
    }

    processedExpenses.push({
      csvRowNumber: rowNum,
      date: expenseDate,
      description: descStr.trim(),
      amount: rawAmount,
      currency: detectedCurrency,
      exchangeRate,
      amountInr,
      paidByName: resolvedPayer,
      splitType,
      splits,
      isSettlement,
      settlementDetails,
    });
  });

  return {
    filename,
    totalRows: rawRows.length,
    importedRows: processedExpenses.length,
    skippedRows,
    anomalyCount: anomalies.length,
    anomalies,
    expenses: processedExpenses,
  };
}
