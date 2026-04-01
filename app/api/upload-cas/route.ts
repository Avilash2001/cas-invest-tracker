import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Transaction from "@/models/Transaction";
import Fund from "@/models/Fund";
import { parseCASPDF } from "@/lib/parsers/cas-pdf";
import { parseCASExcel } from "@/lib/parsers/cas-excel";

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

  await connectDB();
  const userId = session.user.id;

  // Upsert funds
  for (const fund of parsed.funds) {
    if (!fund.amfiCode) continue;
    await Fund.findOneAndUpdate(
      { userId, amfiCode: fund.amfiCode },
      {
        userId,
        amfiCode: fund.amfiCode,
        schemeName: fund.schemeName,
        fundHouse: fund.fundHouse,
        category: inferCategory(fund.schemeName),
        subCategory: inferSubCategory(fund.schemeName),
        folioNumber: fund.folioNumber,
        currentUnits: fund.currentUnits,
      },
      { upsert: true, new: true }
    );
  }

  // Compute units from transactions for funds without explicit closing balance
  const unitsByFund: Record<string, number> = {};

  // Upsert transactions (deduplicate by amfiCode + date + type + units)
  let inserted = 0;
  for (const tx of parsed.transactions) {
    if (!tx.amfiCode) continue;
    const existing = await Transaction.findOne({
      userId,
      amfiCode: tx.amfiCode,
      date: tx.date,
      type: tx.type,
      units: tx.units,
    });
    if (!existing) {
      await Transaction.create({
        userId,
        folioNumber: tx.folioNumber,
        amfiCode: tx.amfiCode,
        fundName: tx.fundName,
        date: tx.date,
        type: tx.type,
        amount: tx.amount,
        units: tx.units,
        nav: tx.nav,
      });
      inserted++;
    }

    // Track units
    if (!unitsByFund[tx.amfiCode]) unitsByFund[tx.amfiCode] = 0;
    if (tx.type === "purchase" || tx.type === "switch_in") {
      unitsByFund[tx.amfiCode] += tx.units;
    } else if (tx.type === "redemption" || tx.type === "switch_out") {
      unitsByFund[tx.amfiCode] -= tx.units;
    }
  }

  // Update current units for funds not in explicit fund list
  for (const [amfiCode, units] of Object.entries(unitsByFund)) {
    await Fund.findOneAndUpdate(
      { userId, amfiCode },
      { $setOnInsert: { currentUnits: Math.max(0, units) } },
      { upsert: false }
    );
    // Also ensure fund exists
    const existingFund = await Fund.findOne({ userId, amfiCode });
    if (!existingFund) {
      const txForFund = parsed.transactions.find((t) => t.amfiCode === amfiCode);
      if (txForFund) {
        await Fund.create({
          userId,
          amfiCode,
          schemeName: txForFund.fundName,
          fundHouse: extractFundHouse(txForFund.fundName),
          category: inferCategory(txForFund.fundName),
          subCategory: inferSubCategory(txForFund.fundName),
          folioNumber: txForFund.folioNumber,
          currentUnits: Math.max(0, units),
        });
      }
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
    "HDFC", "ICICI Prudential", "SBI", "Axis", "Nippon",
    "Kotak", "Mirae Asset", "IDFC", "Franklin", "UTI", "DSP",
    "Canara Robeco", "Tata", "Aditya Birla", "Invesco",
  ];
  for (const h of houses) {
    if (name.toLowerCase().includes(h.toLowerCase())) return h;
  }
  return name.split(" ").slice(0, 2).join(" ");
}

function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("debt") || n.includes("bond") || n.includes("liquid") || n.includes("overnight") || n.includes("gilt") || n.includes("corporate")) return "Debt";
  if (n.includes("gold") || n.includes("silver")) return "Gold";
  if (n.includes("international") || n.includes("global") || n.includes("overseas") || n.includes("us ") || n.includes("nasdaq")) return "International";
  if (n.includes("hybrid") || n.includes("balanced") || n.includes("aggressive") || n.includes("conservative") || n.includes("multi asset")) return "Hybrid";
  return "Equity";
}

function inferSubCategory(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("small cap")) return "Small Cap";
  if (n.includes("mid cap")) return "Mid Cap";
  if (n.includes("large & mid") || n.includes("large and mid")) return "Large & Mid Cap";
  if (n.includes("large cap")) return "Large Cap";
  if (n.includes("flexi cap") || n.includes("multi cap") || n.includes("diversified")) return "Flexi Cap";
  if (n.includes("elss") || n.includes("tax saver")) return "ELSS";
  if (n.includes("index") || n.includes("nifty") || n.includes("sensex")) return "Index";
  return "";
}
