import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Transaction from "@/models/Transaction";
import Fund from "@/models/Fund";
import NavCache from "@/models/NavCache";
import { differenceInDays } from "date-fns";

const LTCG_EXEMPTION = 125000; // ₹1.25L
const STCG_TAX_RATE = 0.20;
const LTCG_TAX_RATE = 0.125;

interface Lot {
  date: Date;
  units: number;
  nav: number;
  amfiCode: string;
  fundName: string;
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
  const today = new Date();

  // Build lots using FIFO
  let realisedSTCG = 0;
  let realisedLTCG = 0;

  // Unrealised gains
  let unrealisedSTCG = 0;
  let unrealisedLTCG = 0;

  const taxHarvestOpportunities: Array<{
    fundName: string;
    amfiCode: string;
    unrealisedLoss: number;
    currentValue: number;
  }> = [];

  // Per-fund lot tracking
  for (const fund of funds) {
    const txs = transactions
      .filter((t) => t.amfiCode === fund.amfiCode)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const lots: Lot[] = [];

    for (const tx of txs) {
      if (tx.type === "purchase" || tx.type === "switch_in") {
        lots.push({
          date: new Date(tx.date),
          units: tx.units,
          nav: tx.nav,
          amfiCode: tx.amfiCode,
          fundName: tx.fundName,
        });
      } else if (tx.type === "redemption" || tx.type === "switch_out") {
        // FIFO
        let unitsToRedeem = tx.units;
        while (unitsToRedeem > 0 && lots.length > 0) {
          const lot = lots[0];
          const redeemedUnits = Math.min(lot.units, unitsToRedeem);
          const costBasis = redeemedUnits * lot.nav;
          const saleValue = redeemedUnits * tx.nav;
          const gain = saleValue - costBasis;
          const holdingDays = differenceInDays(new Date(tx.date), lot.date);

          if (holdingDays >= 365) {
            realisedLTCG += gain;
          } else {
            realisedSTCG += gain;
          }

          lot.units -= redeemedUnits;
          unitsToRedeem -= redeemedUnits;
          if (lot.units <= 0) lots.shift();
        }
      }
    }

    // Unrealised gains on remaining lots
    const cacheNav = navMap.get(fund.amfiCode);
    const casNav = fund.currentNav ?? 0;
    const currentNav = (cacheNav && casNav && Math.abs(cacheNav - casNav) / casNav > 0.30)
      ? casNav
      : (cacheNav ?? casNav);
    let fundUnrealisedGain = 0;

    for (const lot of lots) {
      const currentLotValue = lot.units * currentNav;
      const costBasis = lot.units * lot.nav;
      const gain = currentLotValue - costBasis;
      const holdingDays = differenceInDays(today, lot.date);

      if (holdingDays >= 365) {
        unrealisedLTCG += gain;
      } else {
        unrealisedSTCG += gain;
      }
      fundUnrealisedGain += gain;
    }

    // Tax harvesting: flag funds with unrealised loss
    if (fundUnrealisedGain < -1000) {
      const totalCurrentValue = fund.currentUnits * currentNav;
      taxHarvestOpportunities.push({
        fundName: fund.schemeName,
        amfiCode: fund.amfiCode,
        unrealisedLoss: fundUnrealisedGain,
        currentValue: totalCurrentValue,
      });
    }
  }

  // Tax liability
  const stcgTax = Math.max(0, realisedSTCG) * STCG_TAX_RATE;
  const ltcgAboveExemption = Math.max(0, realisedLTCG - LTCG_EXEMPTION);
  const ltcgTax = ltcgAboveExemption * LTCG_TAX_RATE;

  // Unrealised tax
  const unrealisedStcgTax = Math.max(0, unrealisedSTCG) * STCG_TAX_RATE;
  const unrealisedLtcgAbove = Math.max(0, unrealisedLTCG - LTCG_EXEMPTION);
  const unrealisedLtcgTax = unrealisedLtcgAbove * LTCG_TAX_RATE;

  return NextResponse.json({
    realised: {
      stcg: realisedSTCG,
      ltcg: realisedLTCG,
      stcgTax,
      ltcgTax,
      totalTax: stcgTax + ltcgTax,
    },
    unrealised: {
      stcg: unrealisedSTCG,
      ltcg: unrealisedLTCG,
      stcgTax: unrealisedStcgTax,
      ltcgTax: unrealisedLtcgTax,
      totalTax: unrealisedStcgTax + unrealisedLtcgTax,
    },
    taxHarvestOpportunities: taxHarvestOpportunities.slice(0, 5),
    constants: {
      stcgRate: STCG_TAX_RATE * 100,
      ltcgRate: LTCG_TAX_RATE * 100,
      ltcgExemption: LTCG_EXEMPTION,
    },
  });
}
