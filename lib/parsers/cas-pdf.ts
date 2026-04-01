/**
 * CAMS/KFintech CAS PDF parser
 *
 * The CAS PDF follows a fairly standard layout:
 * - Header with investor name, PAN, email
 * - Folio sections per fund house
 * - Transaction lines per folio
 *
 * This parser handles the most common CAS PDF formats.
 */

export interface ParsedTransaction {
  folioNumber: string;
  fundName: string;
  amfiCode: string;
  date: Date;
  type: "purchase" | "redemption" | "dividend" | "switch_in" | "switch_out";
  amount: number;
  units: number;
  nav: number;
}

export interface ParsedCAS {
  investorName: string;
  pan: string;
  email: string;
  transactions: ParsedTransaction[];
  funds: Array<{
    amfiCode: string;
    schemeName: string;
    fundHouse: string;
    folioNumber: string;
    currentUnits: number;
  }>;
}

function detectTransactionType(
  description: string
): ParsedTransaction["type"] {
  const d = description.toLowerCase();
  if (d.includes("switch in") || d.includes("switch-in")) return "switch_in";
  if (d.includes("switch out") || d.includes("switch-out")) return "switch_out";
  if (d.includes("redemption") || d.includes("redeem")) return "redemption";
  if (d.includes("dividend") || d.includes("idcw")) return "dividend";
  return "purchase";
}

function parseIndianNumber(s: string): number {
  return parseFloat(s.replace(/,/g, "").trim()) || 0;
}

function parseDate(s: string): Date | null {
  // Common formats: DD-MMM-YYYY, DD/MM/YYYY, DD-MM-YYYY
  const months: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  // DD-MMM-YYYY
  const m1 = s.match(/(\d{2})-([A-Za-z]{3})-(\d{4})/);
  if (m1) {
    const month = months[m1[2].toLowerCase()];
    if (month !== undefined) {
      return new Date(parseInt(m1[3]), month, parseInt(m1[1]));
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const m2 = s.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m2) {
    return new Date(parseInt(m2[3]), parseInt(m2[2]) - 1, parseInt(m2[1]));
  }

  return null;
}

export async function parseCASPDF(buffer: Buffer): Promise<ParsedCAS> {
  // Dynamic import to avoid issues with next.js server components
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  const text = data.text;

  const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);

  const result: ParsedCAS = {
    investorName: "",
    pan: "",
    email: "",
    transactions: [],
    funds: [],
  };

  // Extract investor info
  for (const line of lines) {
    if (!result.investorName && line.match(/^[A-Z][A-Z\s]+$/)) {
      result.investorName = line.trim();
    }
    const panMatch = line.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
    if (panMatch && !result.pan) result.pan = panMatch[1];
    const emailMatch = line.match(/\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i);
    if (emailMatch && !result.email) result.email = emailMatch[0];
  }

  // Parse fund sections and transactions
  let currentFund = "";
  let currentFolio = "";
  let currentFundHouse = "";
  let currentAmfiCode = "";
  let currentUnits = 0;

  const fundMap = new Map<string, typeof result.funds[0]>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect AMFI/ISIN code
    const amfiMatch = line.match(/AMFI[:\s]+(\d{6})/i) || line.match(/\bAmfiCode[:\s]+(\d{6})/i);
    if (amfiMatch) {
      currentAmfiCode = amfiMatch[1];
    }

    // Detect folio number
    const folioMatch = line.match(/Folio\s+(?:No\.?\s*)?:?\s*([A-Z0-9\/\-]+)/i);
    if (folioMatch) {
      currentFolio = folioMatch[1].trim();
    }

    // Detect scheme name (usually a long line with fund-related keywords)
    if (
      line.match(/\b(fund|scheme|growth|dividend|direct|regular|idcw|plan)\b/i) &&
      line.length > 20 &&
      !line.match(/^\d/) &&
      !line.match(/transaction/i)
    ) {
      currentFund = line;
      if (currentAmfiCode && !fundMap.has(currentAmfiCode)) {
        const fh = currentFundHouse || extractFundHouse(line);
        fundMap.set(currentAmfiCode, {
          amfiCode: currentAmfiCode,
          schemeName: line,
          fundHouse: fh,
          folioNumber: currentFolio,
          currentUnits: 0,
        });
      }
    }

    // Detect closing balance / units
    const unitsMatch = line.match(/closing\s+units?[:\s]+([\d,]+\.?\d*)/i) ||
      line.match(/units?\s+held[:\s]+([\d,]+\.?\d*)/i);
    if (unitsMatch && currentAmfiCode) {
      currentUnits = parseIndianNumber(unitsMatch[1]);
      const fund = fundMap.get(currentAmfiCode);
      if (fund) fund.currentUnits = currentUnits;
    }

    // Detect transaction lines
    // Format: DD-MMM-YYYY  Description  Amount  Units  Nav  Balance
    const txMatch = line.match(
      /^(\d{2}[-\/]\w{3}[-\/]\d{4}|\d{2}[-\/]\d{2}[-\/]\d{4})\s+(.+?)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/
    );
    if (txMatch && currentFund && currentAmfiCode) {
      const date = parseDate(txMatch[1]);
      if (date) {
        const type = detectTransactionType(txMatch[2]);
        const amount = parseIndianNumber(txMatch[3]);
        const units = parseIndianNumber(txMatch[4]);
        const nav = parseIndianNumber(txMatch[5]);

        if (amount > 0 || units !== 0) {
          result.transactions.push({
            folioNumber: currentFolio,
            fundName: currentFund,
            amfiCode: currentAmfiCode,
            date,
            type,
            amount,
            units,
            nav,
          });
        }
      }
    }
  }

  result.funds = Array.from(fundMap.values());
  return result;
}

function extractFundHouse(schemeName: string): string {
  const known = [
    "HDFC", "ICICI Prudential", "SBI", "Axis", "Nippon", "Kotak",
    "Mirae Asset", "IDFC", "Franklin", "UTI", "DSP", "Canara Robeco",
    "Tata", "Aditya Birla", "Invesco", "Edelweiss", "PGIM", "Sundaram",
  ];
  for (const house of known) {
    if (schemeName.toLowerCase().includes(house.toLowerCase())) return house;
  }
  return schemeName.split(" ").slice(0, 2).join(" ");
}
