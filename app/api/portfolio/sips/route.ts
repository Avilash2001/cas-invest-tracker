import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Transaction from "@/models/Transaction";
import Fund from "@/models/Fund";
import NavCache from "@/models/NavCache";
import { differenceInDays, format, getDate } from "date-fns";

function detectSIP(
  txs: Array<{ date: Date; amount: number; type: string }>
): { isSIP: boolean; monthlyAmount: number; dayOfMonth: number } {
  const purchases = txs
    .filter((t) => t.type === "purchase")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (purchases.length < 3) return { isSIP: false, monthlyAmount: 0, dayOfMonth: 0 };

  // Check if purchases happen on approximately the same day each month
  const days = purchases.map((p) => getDate(new Date(p.date)));
  const avgDay = Math.round(days.reduce((s, d) => s + d, 0) / days.length);
  const dayVariance = days.every((d) => Math.abs(d - avgDay) <= 5);

  if (!dayVariance || purchases.length < 3) return { isSIP: false, monthlyAmount: 0, dayOfMonth: 0 };

  // Check intervals are roughly monthly
  let monthlyCount = 0;
  for (let i = 1; i < purchases.length; i++) {
    const diff = differenceInDays(
      new Date(purchases[i].date),
      new Date(purchases[i - 1].date)
    );
    if (diff >= 25 && diff <= 35) monthlyCount++;
  }

  if (monthlyCount < purchases.length - 2) return { isSIP: false, monthlyAmount: 0, dayOfMonth: 0 };

  const amounts = purchases.map((p) => p.amount);
  const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;

  return { isSIP: true, monthlyAmount: avgAmount, dayOfMonth: avgDay };
}

function futureValue(monthly: number, rate: number, months: number): number {
  const r = rate / 12 / 100;
  if (r === 0) return monthly * months;
  return monthly * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
}

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

  // Build SIP calendar data
  const sipCalendar: Record<string, number> = {};

  const sips = funds
    .map((fund) => {
      const txs = transactions
        .filter((t) => t.amfiCode === fund.amfiCode)
        .map((t) => ({ date: new Date(t.date), amount: t.amount, type: t.type }));

      const { isSIP, monthlyAmount, dayOfMonth } = detectSIP(txs);
      if (!isSIP) return null;

      const purchases = txs.filter((t) => t.type === "purchase").sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      );

      const sipStart = purchases[0].date;
      const totalInvested = purchases.reduce((s, p) => s + p.amount, 0);
      const currentNav = navMap.get(fund.amfiCode) ?? 0;
      const currentValue = fund.currentUnits * currentNav;

      const monthsElapsed = purchases.length;
      const targetMonths = 120; // 10 years default

      // Calendar heatmap
      for (const p of purchases) {
        const key = format(p.date, "yyyy-MM-dd");
        sipCalendar[key] = (sipCalendar[key] ?? 0) + p.amount;
      }

      // Projections at 12, 15, 18% CAGR for remaining months
      const remainingMonths = Math.max(0, targetMonths - monthsElapsed);

      return {
        amfiCode: fund.amfiCode,
        schemeName: fund.schemeName,
        monthlyAmount,
        dayOfMonth,
        sipStartDate: sipStart.toISOString(),
        totalInvested,
        currentValue,
        monthsElapsed,
        targetMonths,
        projections: {
          at12: currentValue + futureValue(monthlyAmount, 12, remainingMonths),
          at15: currentValue + futureValue(monthlyAmount, 15, remainingMonths),
          at18: currentValue + futureValue(monthlyAmount, 18, remainingMonths),
        },
      };
    })
    .filter(Boolean);

  return NextResponse.json({ sips, sipCalendar });
}
