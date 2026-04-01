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
/**
 * Validate a candidate amfiCode by fetching its latest NAV and comparing to
 * the CAS NAV. Returns false if the NAV differs by more than 30% (wrong fund).
 */
async function validateAmfiCode(amfiCode: string, casNav: number): Promise<boolean> {
  if (!casNav || casNav <= 0) return true; // no CAS NAV to validate against
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${amfiCode}`, { next: { revalidate: 3600 } });
    if (!res.ok) return false;
    const data = await res.json();
    const latestNav = parseFloat(data?.data?.[0]?.nav ?? "0");
    if (latestNav <= 0) return false;
    return Math.abs(latestNav - casNav) / casNav < 0.30; // within 30%
  } catch {
    return false;
  }
}

export async function resolveAmfiCodeFromIsin(
  isin: string,
  schemeName: string,
  casNav?: number
): Promise<string | null> {
  // Helper: search mfapi.in, validate each result against CAS NAV
  const searchAndValidate = async (query: string): Promise<string | null> => {
    try {
      const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`, {
        next: { revalidate: 86400 },
      });
      if (!res.ok) return null;
      const results: MFApiSearchResult[] = await res.json();
      for (const result of results ?? []) {
        const code = String(result.schemeCode);
        if (!casNav || await validateAmfiCode(code, casNav)) {
          return code;
        }
      }
    } catch { /* ignore */ }
    return null;
  };

  // 1. Search by ISIN
  const byIsin = await searchAndValidate(isin);
  if (byIsin) return byIsin;

  // 2. Fallback: search by scheme name (first 40 chars)
  const byName = await searchAndValidate(schemeName.slice(0, 40));
  if (byName) return byName;

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
