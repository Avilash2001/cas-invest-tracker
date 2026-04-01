import { connectDB } from "./mongodb";
import NavCache from "@/models/NavCache";

interface MFApiSearchResult {
  schemeCode: number;
  schemeName: string;
}

/**
 * Resolve an ISIN to an AMFI scheme code via mfapi.in search.
 * Returns the numeric code as a string, or null if not found.
 */
export async function resolveAmfiCodeFromIsin(isin: string, schemeName: string): Promise<string | null> {
  try {
    // Search by ISIN first
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(isin)}`, {
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const results: MFApiSearchResult[] = await res.json();
      if (results?.length) {
        return String(results[0].schemeCode);
      }
    }
  } catch { /* fall through */ }

  try {
    // Fallback: search by scheme name (first 40 chars)
    const query = schemeName.slice(0, 40);
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`, {
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const results: MFApiSearchResult[] = await res.json();
      if (results?.length) {
        return String(results[0].schemeCode);
      }
    }
  } catch { /* ignore */ }

  return null;
}

interface MFApiResponse {
  meta: {
    scheme_name: string;
    fund_house: string;
    scheme_type: string;
    scheme_category: string;
    scheme_code: number;
  };
  data: Array<{ date: string; nav: string }>;
  status: string;
}

export async function fetchNAV(
  amfiCode: string
): Promise<{ nav: number; navDate: Date } | null> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${amfiCode}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json: MFApiResponse = await res.json();
    if (!json.data?.length) return null;
    const latest = json.data[0];
    const [d, m, y] = latest.date.split("-").map(Number);
    return {
      nav: parseFloat(latest.nav),
      navDate: new Date(y, m - 1, d),
    };
  } catch {
    return null;
  }
}

export async function fetchHistoricalNAV(
  amfiCode: string
): Promise<Array<{ date: Date; nav: number }>> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${amfiCode}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json: MFApiResponse = await res.json();
    return (json.data || []).map((d) => {
      const [dd, mm, yyyy] = d.date.split("-").map(Number);
      return { date: new Date(yyyy, mm - 1, dd), nav: parseFloat(d.nav) };
    });
  } catch {
    return [];
  }
}

export async function getCachedNAV(
  amfiCode: string
): Promise<{ nav: number; navDate: Date; updatedAt: Date } | null> {
  await connectDB();
  const cached = await NavCache.findOne({ amfiCode });
  return cached
    ? { nav: cached.nav, navDate: cached.navDate, updatedAt: cached.updatedAt }
    : null;
}

export async function upsertNAVCache(amfiCode: string): Promise<number | null> {
  await connectDB();
  const data = await fetchNAV(amfiCode);
  if (!data) return null;
  await NavCache.findOneAndUpdate(
    { amfiCode },
    { nav: data.nav, navDate: data.navDate, updatedAt: new Date() },
    { upsert: true, new: true }
  );
  return data.nav;
}
