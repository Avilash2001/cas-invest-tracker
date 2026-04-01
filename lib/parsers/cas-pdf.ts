/**
 * MFCentral / CAMS / KFintech CAS PDF parser
 *
 * Real format observed:
 *   DD-MMM-YYYYDescriptionAMOUNTUNITSPRICEUNIT_BALANCE  (all concatenated)
 *
 * Column widths in the PDF cause the 4 numeric columns to be concatenated in text extraction:
 *   Amount  (2 dp)  e.g. 2,499.88
 *   Units   (3 dp)  e.g. 27.810
 *   Price   (2 dp)  e.g. 89.89
 *   Balance (3 dp)  e.g. 27.810
 */

export interface ParsedTransaction {
  folioNumber: string;
  fundName: string;
  isin: string;
  amfiCode: string;       // ISIN used as identifier; resolved to AMFI code later
  date: Date;
  type: "purchase" | "redemption" | "dividend" | "switch_in" | "switch_out";
  amount: number;
  units: number;
  nav: number;
}

export interface ParsedFund {
  amfiCode: string;
  isin: string;
  schemeName: string;
  fundHouse: string;
  folioNumber: string;
  currentUnits: number;
  currentNav: number;
}

export interface ParsedCAS {
  investorName: string;
  pan: string;
  email: string;
  transactions: ParsedTransaction[];
  funds: ParsedFund[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  // DD-MMM-YYYY
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const m = s.match(/^(\d{2})-([A-Z]{3})-(\d{4})$/);
  if (!m) return null;
  const mon = months[m[2]];
  if (mon === undefined) return null;
  return new Date(parseInt(m[3]), mon, parseInt(m[1]));
}

function detectType(description: string): ParsedTransaction["type"] {
  const d = description.toLowerCase();
  if (d.includes("switch in")) return "switch_in";
  if (d.includes("switch out")) return "switch_out";
  if (d.includes("redemption") || d.includes("redeem")) return "redemption";
  if (d.includes("dividend") || d.includes("idcw")) return "dividend";
  return "purchase";
}

/**
 * Split the concatenated number tail of a CAS transaction line into 4 values.
 *
 * The PDF columns (Amount 2dp, Units 3dp, NAV 2dp, Balance 3dp) are concatenated
 * without any delimiter. The description may also end with digits (e.g. "Instalment No - 1").
 *
 * Algorithm:
 *   1. Strip everything except digits and dots from the tail string.
 *   2. Find the LAST 4 dot positions — these are exactly the decimal points of the 4 columns.
 *      (Using last-4 handles descriptions that contain a dot, e.g. "Sys. Investment")
 *   3. Each column's decimal length is known: amount=2dp, units=3dp, nav=2dp, balance=3dp.
 *      Use that to split the inter-dot digit groups correctly.
 *   4. For the amount's integer part, trim leading "garbage" digits from the description tail
 *      using the constraint: amount ≈ units × nav (within 3%).
 */
function parseNumbers(tail: string): { amount: number; units: number; nav: number; balance: number } | null {
  // Keep only digits and dots
  const d = tail.replace(/[^\d.]/g, "");

  // Find positions of all dots
  const dotPositions: number[] = [];
  for (let i = 0; i < d.length; i++) {
    if (d[i] === ".") dotPositions.push(i);
  }

  // Need at least 4 dots (one per column)
  if (dotPositions.length < 4) return null;

  // Use the LAST 4 dots
  const [p0, p1, p2, p3] = dotPositions.slice(-4);

  // Decimal counts per column: amount=2, units=3, nav=2, balance=3
  // After p0: first 2 chars = amount decimal, rest until p1 = units integer start
  // After p1: first 3 chars = units decimal, rest until p2 = nav integer start
  // After p2: first 2 chars = nav decimal, rest until p3 = balance integer start
  // After p3: remaining chars = balance decimal (must be 3)

  const amtDec   = d.slice(p0 + 1, p0 + 3);   // 2 chars
  const unitsInt = d.slice(p0 + 3, p1);
  const unitsDec = d.slice(p1 + 1, p1 + 4);   // 3 chars
  const navInt   = d.slice(p1 + 4, p2);
  const navDec   = d.slice(p2 + 1, p2 + 3);   // 2 chars
  const balInt   = d.slice(p2 + 3, p3);
  const balDec   = d.slice(p3 + 1);            // 3 chars

  if (amtDec.length < 2 || unitsDec.length < 3 || navDec.length < 2 || balDec.length < 3) {
    return null;
  }

  const units   = parseFloat((unitsInt || "0") + "." + unitsDec);
  const nav     = parseFloat((navInt   || "0") + "." + navDec);
  const balance = parseFloat((balInt   || "0") + "." + balDec);

  // Amount integer: everything before p0, then trim leading garbage using amount ≈ units × nav
  const rawAmtInt = d.slice(0, p0);
  let amount = 0;

  if (units > 0 && nav > 0) {
    // Try removing leading digits one at a time until amount/units ≈ nav
    for (let trim = 0; trim <= rawAmtInt.length; trim++) {
      const candidate = parseFloat((rawAmtInt.slice(trim) || "0") + "." + amtDec);
      if (candidate > 0 && Math.abs(candidate / units - nav) / nav < 0.03) {
        amount = candidate;
        break;
      }
    }
  }

  // Fallback: use full integer (may include garbage) or 0
  if (!amount) {
    amount = parseFloat((rawAmtInt || "0") + "." + amtDec);
  }

  return { amount, units, nav, balance };
}

/**
 * Given a full line like:
 *   04-JUN-2025Purchase Systematic-BSE - Instalment No - 12,499.8827.81089.8927.810
 * Split it into: { date, description, numbers }
 */
function parseTxLine(line: string): {
  date: Date;
  description: string;
  amount: number;
  units: number;
  nav: number;
} | null {
  const dateMatch = line.match(/^(\d{2}-[A-Z]{3}-\d{4})/);
  if (!dateMatch) return null;
  const date = parseDate(dateMatch[1]);
  if (!date) return null;

  const rest = line.slice(dateMatch[1].length);
  const nums = parseNumbers(rest);
  if (!nums) return null;

  // Use rest as description — detectType checks for text keywords not present in number strings
  const description = rest;

  // Skip zero-amount administrative entries (nominee registration, address updates)
  if (nums.amount === 0 && nums.units === 0) return null;

  return { date, description, amount: nums.amount, units: nums.units, nav: nums.nav };
}

// ── main parser ───────────────────────────────────────────────────────────────

export async function parseCASPDF(buffer: Buffer): Promise<ParsedCAS> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  const raw: string = data.text;

  const lines = raw.split("\n").map((l: string) => l.trim()).filter(Boolean);

  const result: ParsedCAS = {
    investorName: "",
    pan: "",
    email: "",
    transactions: [],
    funds: [],
  };

  // ── investor info ──────────────────────────────────────────────────────────
  for (const line of lines) {
    if (!result.pan) {
      const panM = line.match(/^PAN:\s*([A-Z]{5}[0-9]{4}[A-Z])/);
      if (panM) result.pan = panM[1];
    }
    if (!result.email) {
      const emailM = line.match(/\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i);
      if (emailM) result.email = emailM[0];
    }
    if (!result.investorName && result.pan && !result.investorName) {
      // Name appears right after PAN line — capture next non-empty, non-address-like line
      // We'll do a second pass below
    }
  }

  // Name is the line immediately after "PAN: XXXX"
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^PAN:\s*[A-Z]{5}[0-9]{4}[A-Z]/) && i + 1 < lines.length) {
      result.investorName = lines[i + 1].trim();
      break;
    }
  }

  // ── fund / transaction parsing ─────────────────────────────────────────────
  const fundMap = new Map<string, ParsedFund>();

  let currentFundHouse = "";
  let currentFolio = "";
  let currentSchemeName = "";
  let currentIsin = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip page headers/footers
    if (
      line.startsWith("Consolidated Account Statement") ||
      line.startsWith("Page ") ||
      line.startsWith("MFCentralDetailCAS") ||
      line.startsWith("SoA Holdings") ||
      line.startsWith("TransactionAmount") ||
      line.startsWith("Price") ||
      line.startsWith("(INR)") ||
      line.startsWith("Unit Balance") ||
      line.startsWith("To Date") ||
      line.startsWith("No Folios Found") ||
      line.startsWith("--") ||
      line.startsWith("#IDCW") ||
      line.startsWith("*SoA") ||
      line === "Date"
    ) continue;

    // Fund house header (all caps or known pattern, no digits, not a scheme line)
    if (
      !line.match(/^\d{2}-[A-Z]{3}-\d{4}/) &&
      !line.match(/FOLIO NO:/) &&
      !line.match(/ISIN:/) &&
      !line.match(/Closing Unit/) &&
      !line.match(/Opening Unit/) &&
      !line.match(/KYC/) &&
      line.length < 80 &&
      line === line.toUpperCase() &&
      /^[A-Z][A-Z\s]+$/.test(line)
    ) {
      currentFundHouse = line.trim();
      continue;
    }

    // Mixed-case fund house names (e.g., "PPFAS Mutual Fund", "Nippon India Mutual Fund")
    if (
      !line.match(/^\d{2}-[A-Z]{3}-\d{4}/) &&
      !line.match(/FOLIO NO:/) &&
      !line.match(/ISIN:/) &&
      !line.match(/Closing|Opening|KYC/) &&
      line.match(/Mutual Fund|Asset Management|AMC/i) &&
      line.length < 80 &&
      !line.match(/^\d/)
    ) {
      currentFundHouse = line.trim();
      continue;
    }

    // Folio line
    const folioM = line.match(/FOLIO NO:\s*([A-Z0-9\/]+)/i);
    if (folioM) {
      currentFolio = folioM[1].trim();
      continue;
    }

    // Scheme line (contains ISIN)
    const isinM = line.match(/ISIN:\s*([A-Z]{2}[A-Z0-9]{10})/);
    if (isinM) {
      currentIsin = isinM[1];
      // Scheme name is everything before the first parenthesis or " ISIN:"
      currentSchemeName = line
        .replace(/\(.*$/s, "")
        .replace(/ISIN:.*$/i, "")
        .trim();
      if (!currentSchemeName) currentSchemeName = line.split(" ISIN:")[0].trim();

      if (currentIsin && !fundMap.has(currentIsin)) {
        fundMap.set(currentIsin, {
          amfiCode: currentIsin, // placeholder; resolved later via mfapi search
          isin: currentIsin,
          schemeName: currentSchemeName,
          fundHouse: currentFundHouse,
          folioNumber: currentFolio,
          currentUnits: 0,
          currentNav: 0,
        });
      }
      continue;
    }

    // Closing unit balance line
    const closingM = line.match(/Closing Unit Balance:\s*([\d.]+).*?INR\s+([\d.]+).*?INR\s+([\d,]+\.[\d]+)/i);
    if (closingM && currentIsin) {
      const fund = fundMap.get(currentIsin);
      if (fund) {
        fund.currentUnits = parseFloat(closingM[1]);
        fund.currentNav = parseFloat(closingM[2]);
      }
      continue;
    }

    // Transaction line: starts with DD-MMM-YYYY
    if (line.match(/^\d{2}-[A-Z]{3}-\d{4}/) && currentIsin) {
      const tx = parseTxLine(line);
      if (tx) {
        result.transactions.push({
          folioNumber: currentFolio,
          fundName: currentSchemeName,
          isin: currentIsin,
          amfiCode: currentIsin,
          date: tx.date,
          type: detectType(tx.description),
          amount: tx.amount,
          units: tx.units,
          nav: tx.nav,
        });
      }
    }
  }

  result.funds = Array.from(fundMap.values());
  return result;
}
