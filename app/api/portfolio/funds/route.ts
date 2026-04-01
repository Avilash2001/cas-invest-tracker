import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Transaction from "@/models/Transaction";
import Fund from "@/models/Fund";
import NavCache from "@/models/NavCache";
import { calculateXIRR, buildCashFlows } from "@/lib/xirr";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const userId = session.user.id;

  const [funds, transactions, navCaches] = await Promise.all([
    Fund.find({ userId }),
    Transaction.find({ userId }).sort({ date: 1 }),
    NavCache.find({}),
  ]);

  const navMap = new Map(navCaches.map((n) => [n.amfiCode, n.nav]));

  const result = funds
    .map((fund) => {
      const txs = transactions.filter((t) => t.amfiCode === fund.amfiCode);
      if (!txs.length) return null;

      let invested = 0;
      let totalUnits = 0;
      let totalCost = 0;
      for (const tx of txs) {
        if (tx.type === "purchase" || tx.type === "switch_in") {
          invested += tx.amount;
          totalUnits += tx.units;
          totalCost += tx.amount;
        } else if (tx.type === "redemption" || tx.type === "switch_out") {
          totalUnits -= tx.units;
        }
      }

      const currentNav = navMap.get(fund.amfiCode) ?? 0;
      const currentValue = fund.currentUnits * currentNav;
      const avgBuyNAV = totalUnits > 0 ? totalCost / totalUnits : 0;
      const unrealisedPnL = currentValue - invested;
      const unrealisedPnLPercent = invested > 0 ? (unrealisedPnL / invested) * 100 : 0;

      const cashFlows = buildCashFlows(txs, currentValue);
      const xirr = calculateXIRR(cashFlows);

      return {
        amfiCode: fund.amfiCode,
        schemeName: fund.schemeName,
        fundHouse: fund.fundHouse,
        category: fund.category,
        subCategory: fund.subCategory,
        folioNumber: fund.folioNumber,
        currentUnits: fund.currentUnits,
        invested,
        currentValue,
        avgBuyNAV,
        currentNAV: currentNav,
        unrealisedPnL,
        unrealisedPnLPercent,
        xirr: xirr ? xirr * 100 : null,
        transactions: txs.map((t) => ({
          date: t.date,
          type: t.type,
          amount: t.amount,
          units: t.units,
          nav: t.nav,
        })),
      };
    })
    .filter(Boolean);

  return NextResponse.json({ funds: result });
}
