"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MiniSparkline } from "@/components/charts/mini-sparkline";
import { ChartErrorBoundary } from "./error-card";
import { formatCurrency, formatPercent, formatUnits, formatNAV } from "@/lib/format";
import { ChevronDown, ChevronRight, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Transaction {
  date: string;
  type: string;
  amount: number;
  units: number;
  nav: number;
}

interface FundData {
  amfiCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  subCategory: string;
  currentUnits: number;
  invested: number;
  currentValue: number;
  avgBuyNAV: number;
  currentNAV: number;
  unrealisedPnL: number;
  unrealisedPnLPercent: number;
  xirr: number | null;
  transactions: Transaction[];
}

function categoryVariant(cat: string) {
  if (cat === "Debt") return "debt";
  if (cat === "Hybrid") return "hybrid";
  if (cat === "Gold") return "gold";
  if (cat === "International") return "international";
  return "equity";
}

function txLabel(type: string) {
  const map: Record<string, string> = {
    purchase: "Purchase",
    redemption: "Redemption",
    dividend: "Dividend",
    switch_in: "Switch In",
    switch_out: "Switch Out",
  };
  return map[type] ?? type;
}

function txColor(type: string) {
  if (type === "purchase" || type === "switch_in") return "text-emerald-400";
  if (type === "redemption" || type === "switch_out") return "text-red-400";
  return "text-amber-400";
}

/* ── Transaction history (shared between mobile + desktop) ── */
function TransactionHistory({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        Transaction History
      </p>
      <div className="max-h-64 overflow-y-auto space-y-0">
        {transactions.map((tx, i) => (
          <div
            key={i}
            className="flex flex-wrap items-center gap-x-4 gap-y-0.5 py-2 border-b border-border/50 last:border-0 text-xs sm:text-sm"
          >
            <span className="text-muted-foreground w-24 shrink-0">
              {format(new Date(tx.date), "d MMM yyyy")}
            </span>
            <span className={cn("w-20 font-medium shrink-0", txColor(tx.type))}>
              {txLabel(tx.type)}
            </span>
            <span className="text-foreground">{formatCurrency(tx.amount)}</span>
            <span className="text-muted-foreground">{formatUnits(tx.units)} units</span>
            <span className="text-muted-foreground">@ ₹{formatNAV(tx.nav)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Mobile card view ── */
function FundCard({ fund }: { fund: FundData }) {
  const [expanded, setExpanded] = useState(false);
  const isGain = fund.unrealisedPnL >= 0;

  return (
    <div className="border-b border-border last:border-0">
      <button
        className="w-full text-left px-4 py-4 hover:bg-secondary/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Row 1: name + chevron */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight line-clamp-2">{fund.schemeName}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <Badge variant={categoryVariant(fund.category) as "equity" | "debt" | "hybrid" | "gold" | "international"} className="text-[10px] py-0">
                {fund.category}
              </Badge>
              {fund.subCategory && (
                <span className="text-[10px] text-muted-foreground">{fund.subCategory}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ChartErrorBoundary>
              <MiniSparkline
                data={fund.transactions.slice(-12).map((t) => t.nav)}
                color={isGain ? "#10B981" : "#EF4444"}
              />
            </ChartErrorBoundary>
            {expanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />
            }
          </div>
        </div>

        {/* Row 2: key metrics grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
          <div>
            <span className="text-muted-foreground">Invested </span>
            <span className="font-medium">{formatCurrency(fund.invested)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Current </span>
            <span className="font-medium">{formatCurrency(fund.currentValue)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">P&L </span>
            <span className={cn("font-semibold", isGain ? "text-emerald-400" : "text-red-400")}>
              {formatCurrency(fund.unrealisedPnL)} ({formatPercent(fund.unrealisedPnLPercent)})
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">XIRR </span>
            {fund.xirr !== null ? (
              <span className={fund.xirr >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                {fund.xirr.toFixed(1)}%
              </span>
            ) : <span className="text-muted-foreground">—</span>}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-secondary/20">
          <TransactionHistory transactions={fund.transactions} />
        </div>
      )}
    </div>
  );
}

/* ── Desktop table row ── */
function FundRow({ fund }: { fund: FundData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="border-b border-border hover:bg-secondary/40 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            }
            <div>
              <p className="text-sm font-medium leading-tight line-clamp-2">{fund.schemeName}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge variant={categoryVariant(fund.category) as "equity" | "debt" | "hybrid" | "gold" | "international"} className="text-[10px] py-0">
                  {fund.category}
                </Badge>
                {fund.subCategory && (
                  <span className="text-[10px] text-muted-foreground">{fund.subCategory}</span>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-right">{formatCurrency(fund.invested)}</td>
        <td className="px-4 py-3 text-sm text-right">{formatCurrency(fund.currentValue)}</td>
        <td className="px-4 py-3 text-sm text-right text-muted-foreground">{formatUnits(fund.currentUnits)}</td>
        <td className="px-4 py-3 text-sm text-right text-muted-foreground">{formatNAV(fund.avgBuyNAV)}</td>
        <td className="px-4 py-3 text-sm text-right">{formatNAV(fund.currentNAV)}</td>
        <td className="px-4 py-3 text-right">
          <div className={cn("text-sm font-medium", fund.unrealisedPnL >= 0 ? "text-emerald-400" : "text-red-400")}>
            {formatCurrency(fund.unrealisedPnL)}
          </div>
          <div className={cn("text-xs", fund.unrealisedPnL >= 0 ? "text-emerald-400/70" : "text-red-400/70")}>
            {formatPercent(fund.unrealisedPnLPercent)}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-right">
          {fund.xirr !== null ? (
            <span className={fund.xirr >= 0 ? "text-emerald-400" : "text-red-400"}>
              {fund.xirr.toFixed(1)}%
            </span>
          ) : <span className="text-muted-foreground">—</span>}
        </td>
        <td className="px-4 py-3">
          <ChartErrorBoundary>
            <MiniSparkline
              data={fund.transactions.slice(-12).map((t) => t.nav)}
              color={fund.unrealisedPnL >= 0 ? "#10B981" : "#EF4444"}
            />
          </ChartErrorBoundary>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-secondary/20">
          <td colSpan={9} className="px-6 py-4">
            <TransactionHistory transactions={fund.transactions} />
          </td>
        </tr>
      )}
    </>
  );
}

export function FundsTab() {
  const [funds, setFunds] = useState<FundData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portfolio/funds")
      .then((r) => r.json())
      .then((d) => {
        setFunds(d.funds ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-0">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-4 py-4 border-b border-border space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!funds.length) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        No fund data available.
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fund Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Mobile: card list (hidden on md+) */}
        <div className="md:hidden">
          {funds.map((fund) => (
            <FundCard key={fund.amfiCode} fund={fund} />
          ))}
        </div>

        {/* Desktop: scrollable table (hidden below md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Fund</th>
                <th className="px-4 py-3 text-right">Invested</th>
                <th className="px-4 py-3 text-right">Current Value</th>
                <th className="px-4 py-3 text-right">Units</th>
                <th className="px-4 py-3 text-right">Avg NAV</th>
                <th className="px-4 py-3 text-right">Cur NAV</th>
                <th className="px-4 py-3 text-right">P&amp;L</th>
                <th className="px-4 py-3 text-right">XIRR</th>
                <th className="px-4 py-3 text-center">Trend</th>
              </tr>
            </thead>
            <tbody>
              {funds.map((fund) => (
                <FundRow key={fund.amfiCode} fund={fund} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
