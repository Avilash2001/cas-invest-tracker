/**
 * Format a number as Indian currency (₹X,XX,XXX)
 */
export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 1_00_00_000) {
      return `₹${(value / 1_00_00_000).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} Cr`;
    }
    if (Math.abs(value) >= 1_00_000) {
      return `₹${(value / 1_00_000).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} L`;
    }
  }
  return value.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a percentage with sign
 */
export function formatPercent(value: number, decimals = 2): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format units (up to 4 decimal places)
 */
export function formatUnits(value: number): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 4,
  });
}

/**
 * Format NAV value
 */
export function formatNAV(value: number): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

/**
 * Compact number for KPI display
 */
export function compactNumber(value: number): string {
  if (Math.abs(value) >= 1_00_00_000) {
    return `${(value / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (Math.abs(value) >= 1_00_000) {
    return `${(value / 1_00_000).toFixed(2)} L`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)} K`;
  }
  return value.toFixed(0);
}
