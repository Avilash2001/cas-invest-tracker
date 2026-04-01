// eslint-disable-next-line @typescript-eslint/no-require-imports
const xirrLib = require("xirr");

export interface CashFlow {
  amount: number;
  when: Date;
}

/**
 * Calculate XIRR given cash flows.
 * Returns annualised return as a decimal (e.g. 0.15 = 15%), or null on failure.
 */
export function calculateXIRR(cashFlows: CashFlow[]): number | null {
  if (cashFlows.length < 2) return null;
  try {
    // xirr expects: negative values = outflows (investments), positive = inflows (redemptions / current value)
    const result = xirrLib(cashFlows);
    if (!isFinite(result) || isNaN(result)) return null;
    return result;
  } catch {
    return null;
  }
}

/**
 * Build cash flows array from transactions + current value for XIRR
 */
export function buildCashFlows(
  transactions: Array<{
    date: Date;
    type: string;
    amount: number;
    units: number;
  }>,
  currentValue: number
): CashFlow[] {
  const flows: CashFlow[] = [];

  for (const tx of transactions) {
    if (tx.type === "purchase" || tx.type === "switch_in") {
      flows.push({ amount: -Math.abs(tx.amount), when: new Date(tx.date) });
    } else if (tx.type === "redemption" || tx.type === "switch_out") {
      flows.push({ amount: Math.abs(tx.amount), when: new Date(tx.date) });
    }
    // dividends are ignored for XIRR (or could be added as positive flows)
  }

  // Add current value as a positive flow today
  if (currentValue > 0) {
    flows.push({ amount: currentValue, when: new Date() });
  }

  return flows.sort((a, b) => a.when.getTime() - b.when.getTime());
}
