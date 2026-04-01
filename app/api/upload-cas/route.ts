import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Transaction from "@/models/Transaction";
import Fund from "@/models/Fund";
import { parseCASPDF } from "@/lib/parsers/cas-pdf";
import { parseCASExcel } from "@/lib/parsers/cas-excel";
import { resolveAmfiCodeFromIsin } from "@/lib/nav";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const isPDF = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";

  let parsed;
  try {
    if (isPDF) {
      parsed = await parseCASPDF(buffer);
    } else {
      parsed = parseCASExcel(buffer);
    }
  } catch (err) {
    console.error("Parse error:", err);
    return NextResponse.json({ error: "Failed to parse file" }, { status: 422 });
  }

  if (!parsed.funds.length && !parsed.transactions.length) {
    return NextResponse.json({ error: "No fund data found in file. Please ensure it is a valid CAS statement." }, { status: 422 });
  }

  await connectDB();
  const userId = session.user.id;

  // Resolve ISIN → AMFI code for each fund (mfapi.in search)
  const isinToAmfi = new Map<string, string>();
  await Promise.all(
    parsed.funds.map(async (fund) => {
      if (!fund.isin) return;
      // Check DB first
      const existing = await Fund.findOne({ userId, $or: [{ amfiCode: fund.isin }, { isin: fund.isin }] });
      if (existing?.amfiCode && !existing.amfiCode.startsWith("IN")) {
        // Already resolved to numeric AMFI code
        isinToAmfi.set(fund.isin, existing.amfiCode);
        return;
      }
      const amfi = await resolveAmfiCodeFromIsin(fund.isin, fund.schemeName);
      if (amfi) isinToAmfi.set(fund.isin, amfi);
    })
  );

  // Upsert funds
  for (const fund of parsed.funds) {
    const amfiCode = isinToAmfi.get(fund.isin) ?? fund.isin;
    await Fund.findOneAndUpdate(
      { userId, $or: [{ amfiCode }, { amfiCode: fund.isin }] },
      {
        $set: {
          userId,
          amfiCode,
          isin: fund.isin,
          schemeName: fund.schemeName,
          fundHouse: fund.fundHouse || extractFundHouse(fund.schemeName),
          category: inferCategory(fund.schemeName),
          subCategory: inferSubCategory(fund.schemeName),
          folioNumber: fund.folioNumber,
          currentUnits: fund.currentUnits,
          currentNav: fund.currentNav,
        },
      },
      { upsert: true, new: true }
    );
  }

  // Upsert transactions (deduplicate by amfiCode + date + type + units)
  let inserted = 0;
  for (const tx of parsed.transactions) {
    if (!tx.isin) continue;
    const amfiCode = isinToAmfi.get(tx.isin) ?? tx.isin;
    const existing = await Transaction.findOne({
      userId,
      amfiCode,
      date: tx.date,
      type: tx.type,
      units: tx.units,
    });
    if (!existing) {
      await Transaction.create({
        userId,
        folioNumber: tx.folioNumber,
        amfiCode,
        fundName: tx.fundName,
        date: tx.date,
        type: tx.type,
        amount: tx.amount,
        units: tx.units,
        nav: tx.nav,
      });
      inserted++;
    }
  }

  const totalFunds = await Fund.countDocuments({ userId });
  const totalTx = await Transaction.countDocuments({ userId });

  return NextResponse.json({
    success: true,
    imported: { transactions: inserted, funds: parsed.funds.length },
    totals: { transactions: totalTx, funds: totalFunds },
  });
}

function extractFundHouse(name: string): string {
  const houses = [
    "PPFAS", "Parag Parikh", "HDFC", "ICICI Prudential", "SBI", "Axis", "Nippon",
    "Kotak", "Mirae Asset", "IDFC", "Franklin", "UTI", "DSP", "Canara Robeco",
    "Tata", "Aditya Birla", "Invesco", "PGIM", "Motilal Oswal", "Edelweiss",
    "Sundaram", "Quant", "Bandhan", "Navi",
  ];
  for (const h of houses) {
    if (name.toLowerCase().includes(h.toLowerCase())) return h;
  }
  return name.split(" ").slice(0, 2).join(" ");
}

function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("debt") || n.includes("bond") || n.includes("liquid") || n.includes("overnight") || n.includes("gilt") || n.includes("corporate") || n.includes("income plan") || n.includes("hybrid debt")) return "Debt";
  if (n.includes("gold") || n.includes("silver")) return "Gold";
  if (n.includes("international") || n.includes("global") || n.includes("overseas") || n.includes("nasdaq") || n.includes("fof") || n.includes("fund of fund")) return "International";
  if (n.includes("hybrid") || n.includes("balanced") || n.includes("aggressive") || n.includes("conservative") || n.includes("multi asset")) return "Hybrid";
  return "Equity";
}

function inferSubCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("small cap")) return "Small Cap";
  if (n.includes("mid cap") || n.includes("midcap")) return "Mid Cap";
  if (n.includes("large & mid") || n.includes("large and mid")) return "Large & Mid Cap";
  if (n.includes("large cap") || n.includes("largecap")) return "Large Cap";
  if (n.includes("flexi cap") || n.includes("multi cap") || n.includes("diversified")) return "Flexi Cap";
  if (n.includes("elss") || n.includes("tax saver")) return "ELSS";
  if (n.includes("index") || n.includes("nifty") || n.includes("sensex")) return "Index";
  return "";
}
