import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongodb";
import Fund from "@/models/Fund";
import NavCache from "@/models/NavCache";
import { fetchNAV } from "@/lib/nav";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const userId = session.user.id;
  const funds = await Fund.find({ userId });

  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let updated = 0;
  let skipped = 0;

  await Promise.all(
    funds.map(async (fund) => {
      const cached = await NavCache.findOne({ amfiCode: fund.amfiCode });
      if (cached && cached.updatedAt > staleThreshold) {
        skipped++;
        return;
      }

      const data = await fetchNAV(fund.amfiCode);
      if (!data) return;

      await NavCache.findOneAndUpdate(
        { amfiCode: fund.amfiCode },
        { nav: data.nav, navDate: data.navDate, updatedAt: now },
        { upsert: true }
      );
      updated++;
    })
  );

  return NextResponse.json({
    updated,
    skipped,
    syncedAt: now.toISOString(),
  });
}
