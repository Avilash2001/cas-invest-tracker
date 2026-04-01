import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Fund from "@/models/Fund";
import NavCache from "@/models/NavCache";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const userId = session.user.id;

  const [funds, navCaches] = await Promise.all([
    Fund.find({ userId }),
    NavCache.find({}),
  ]);

  const navMap = new Map(navCaches.map((n) => [n.amfiCode, n.nav]));

  interface FundValue {
    schemeName: string;
    amfiCode: string;
    category: string;
    subCategory: string;
    fundHouse: string;
    value: number;
  }

  const fundValues: FundValue[] = funds.map((f) => ({
    schemeName: f.schemeName,
    amfiCode: f.amfiCode,
    category: f.category || "Equity",
    subCategory: f.subCategory || "",
    fundHouse: f.fundHouse || "Others",
    value: f.currentUnits * (navMap.get(f.amfiCode) ?? 0),
  })).filter((f) => f.value > 0);

  const total = fundValues.reduce((s, f) => s + f.value, 0);

  // Asset class
  const assetClassMap = new Map<string, number>();
  for (const f of fundValues) {
    assetClassMap.set(f.category, (assetClassMap.get(f.category) ?? 0) + f.value);
  }
  const assetClass = Array.from(assetClassMap.entries()).map(([name, value]) => ({
    name,
    value,
    percent: total > 0 ? (value / total) * 100 : 0,
  }));

  // Market cap (equity only)
  const equityFunds = fundValues.filter((f) => f.category === "Equity");
  const equityTotal = equityFunds.reduce((s, f) => s + f.value, 0);
  const marketCapMap = new Map<string, number>();
  const subCatOrder = ["Large Cap", "Mid Cap", "Small Cap", "Flexi Cap", "Index", "ELSS", "Other"];
  for (const f of equityFunds) {
    const sc = f.subCategory || "Other";
    marketCapMap.set(sc, (marketCapMap.get(sc) ?? 0) + f.value);
  }
  const marketCap = Array.from(marketCapMap.entries()).map(([name, value]) => ({
    name,
    value,
    percent: equityTotal > 0 ? (value / equityTotal) * 100 : 0,
  })).sort((a, b) => subCatOrder.indexOf(a.name) - subCatOrder.indexOf(b.name));

  // Fund house (top 6 + others)
  const houseMap = new Map<string, number>();
  for (const f of fundValues) {
    const h = f.fundHouse || "Others";
    houseMap.set(h, (houseMap.get(h) ?? 0) + f.value);
  }
  const sortedHouses = Array.from(houseMap.entries()).sort((a, b) => b[1] - a[1]);
  const top6 = sortedHouses.slice(0, 6);
  const othersValue = sortedHouses.slice(6).reduce((s, [, v]) => s + v, 0);
  if (othersValue > 0) top6.push(["Others", othersValue]);
  const fundHouse = top6.map(([name, value]) => ({
    name,
    value,
    percent: total > 0 ? (value / total) * 100 : 0,
  }));

  // Treemap data
  const treemap = fundValues.map((f) => ({
    name: f.schemeName,
    value: f.value,
    category: f.category,
  }));

  return NextResponse.json({
    assetClass,
    marketCap,
    fundHouse,
    treemap,
    total,
  });
}
