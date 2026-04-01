import * as XLSX from "xlsx";
import type { ParsedCAS } from "./cas-pdf";

function detectType(s: string): ParsedCAS["transactions"][0]["type"] {
  const d = (s || "").toLowerCase();
  if (d.includes("switch in")) return "switch_in";
  if (d.includes("switch out")) return "switch_out";
  if (d.includes("redeem")) return "redemption";
  if (d.includes("dividend") || d.includes("idcw")) return "dividend";
  return "purchase";
}

export function parseCASExcel(buffer: Buffer): ParsedCAS {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const result: ParsedCAS = {
    investorName: "",
    pan: "",
    email: "",
    transactions: [],
    funds: [],
  };

  const fundMap = new Map<string, ParsedCAS["funds"][0]>();

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
    }) as unknown[][];

    let headers: string[] = [];
    let currentFund = "";
    let currentFolio = "";
    let currentAmfiCode = "";

    for (const row of rows) {
      const cells = row.map((c) => String(c ?? "").trim());

      // Detect header row
      if (cells.some((c) => /date/i.test(c)) && cells.some((c) => /amount/i.test(c))) {
        headers = cells.map((c) => c.toLowerCase());
        continue;
      }

      // Detect fund/folio info rows
      const joined = cells.join(" ");
      const folioM = joined.match(/folio[:\s]+([A-Z0-9\/\-]+)/i);
      if (folioM) currentFolio = folioM[1];
      const amfiM = joined.match(/(\d{6})/);
      if (amfiM && cells.length < 4) currentAmfiCode = amfiM[1];
      if (
        cells[0] &&
        cells.length < 4 &&
        /fund|scheme|growth|plan/i.test(joined)
      ) {
        currentFund = cells[0];
        if (currentAmfiCode && !fundMap.has(currentAmfiCode)) {
          fundMap.set(currentAmfiCode, {
            amfiCode: currentAmfiCode,
            isin: "",
            schemeName: currentFund,
            fundHouse: currentFund.split(" ").slice(0, 2).join(" "),
            folioNumber: currentFolio,
            currentUnits: 0,
            currentNav: 0,
          });
        }
      }

      if (!headers.length || cells.length < 4) continue;

      const get = (key: string) => {
        const idx = headers.findIndex((h) => h.includes(key));
        return idx >= 0 ? cells[idx] : "";
      };

      const dateStr = get("date");
      const desc = get("desc") || get("narr") || get("type") || get("trans");
      const amountStr = get("amount");
      const unitsStr = get("unit");
      const navStr = get("nav");

      if (!dateStr || !amountStr) continue;

      const rawDate = dateStr.includes("/") || dateStr.includes("-")
        ? new Date(dateStr.split("/").reverse().join("-"))
        : new Date(dateStr);

      if (isNaN(rawDate.getTime())) continue;

      const amount = parseFloat(amountStr.replace(/,/g, "")) || 0;
      const units = parseFloat(unitsStr.replace(/,/g, "")) || 0;
      const nav = parseFloat(navStr.replace(/,/g, "")) || 0;

      if (amount === 0 && units === 0) continue;

      result.transactions.push({
        folioNumber: currentFolio,
        fundName: currentFund || sheetName,
        isin: "",
        amfiCode: currentAmfiCode,
        date: rawDate,
        type: detectType(desc),
        amount: Math.abs(amount),
        units: Math.abs(units),
        nav,
      });
    }
  }

  result.funds = Array.from(fundMap.values());
  return result;
}
