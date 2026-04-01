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

  if (!funds.length) {
    return NextResponse.json({
      totalInvested: 0,
      currentValue: 0,
      totalReturns: 0,
      returnsPercent: 0,
      xirr: null,
      lastSynced: null,
      hasFunds: false,
    });
  }

  const navMap = new Map(navCaches.map((n) => [n.amfiCode, n.nav]));
  const lastSync = navCaches.reduce(
    (latest, n) => (n.updatedAt > latest ? n.updatedAt : latest),
    new Date(0)
  );

  let totalInvested = 0;
  let currentValue = 0;

  for (const fund of funds) {
    const txs = transactions.filter(
      (t) => t.amfiCode === fund.amfiCode && t.userId.toString() === userId
    );
    for (const tx of txs) {
      if (tx.type === "purchase" || tx.type === "switch_in") {
        totalInvested += tx.amount;
      }
    }
    const nav = navMap.get(fund.amfiCode) ?? 0;
    currentValue += fund.currentUnits * nav;
  }

  const totalReturns = currentValue - totalInvested;
  const returnsPercent = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

  // Portfolio-level XIRR
  const cashFlows = buildCashFlows(transactions, currentValue);
  const xirr = calculateXIRR(cashFlows);

  return NextResponse.json({
    totalInvested,
    currentValue,
    totalReturns,
    returnsPercent,
    xirr: xirr ? xirr * 100 : null,
    lastSynced: lastSync.getTime() > 0 ? lastSync.toISOString() : null,
    hasFunds: true,
  });
}
