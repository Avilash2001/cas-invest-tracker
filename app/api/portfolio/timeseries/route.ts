import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Transaction from "@/models/Transaction";
import Fund from "@/models/Fund";
import { fetchHistoricalNAV } from "@/lib/nav";
import { startOfMonth, endOfMonth, eachMonthOfInterval, format } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const userId = session.user.id;

  const [funds, transactions] = await Promise.all([
    Fund.find({ userId }),
    Transaction.find({ userId }).sort({ date: 1 }),
  ]);

  if (!funds.length || !transactions.length) {
    return NextResponse.json({ data: [] });
  }

  const firstTx = transactions[0];
  const start = startOfMonth(firstTx.date);
  const end = endOfMonth(new Date());
  const months = eachMonthOfInterval({ start, end });

  // Fetch historical NAV for each fund
  const navHistories = new Map<string, Array<{ date: Date; nav: number }>>();
  await Promise.all(
    funds.map(async (fund) => {
      const history = await fetchHistoricalNAV(fund.amfiCode);
      navHistories.set(fund.amfiCode, history);
    })
  );

  // For each month, compute portfolio value
  const data = months.map((month) => {
    const monthEnd = endOfMonth(month);
    let invested = 0;
    let value = 0;

    for (const fund of funds) {
      const history = navHistories.get(fund.amfiCode) ?? [];
      // Units held at end of this month
      let units = 0;
      const txs = transactions.filter(
        (t) => t.amfiCode === fund.amfiCode && new Date(t.date) <= monthEnd
      );
      for (const tx of txs) {
        if (tx.type === "purchase" || tx.type === "switch_in") units += tx.units;
        else if (tx.type === "redemption" || tx.type === "switch_out") units -= tx.units;
      }
      units = Math.max(0, units);

      // NAV closest to month end
      const navEntry =
        history.find((h) => h.date <= monthEnd) ??
        history[history.length - 1];
      const nav = navEntry?.nav ?? 0;
      value += units * nav;
    }

    // Invested at end of this month
    const txsByMonth = transactions.filter((t) => new Date(t.date) <= monthEnd);
    for (const tx of txsByMonth) {
      if (tx.type === "purchase" || tx.type === "switch_in") invested += tx.amount;
      else if (tx.type === "redemption" || tx.type === "switch_out") invested -= tx.amount;
    }

    return {
      month: format(month, "MMM yyyy"),
      date: month.toISOString(),
      invested: Math.max(0, invested),
      value: Math.max(0, value),
      returns: Math.max(0, value) - Math.max(0, invested),
    };
  });

  return NextResponse.json({ data });
}
