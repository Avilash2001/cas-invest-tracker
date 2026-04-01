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
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            )}
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
          <div
            className={cn(
              "text-sm font-medium",
              fund.unrealisedPnL >= 0 ? "text-emerald-400" : "text-red-400"
            )}
          >
            {formatCurrency(fund.unrealisedPnL)}
          </div>
          <div
            className={cn(
              "text-xs",
              fund.unrealisedPnL >= 0 ? "text-emerald-400/70" : "text-red-400/70"
            )}
          >
            {formatPercent(fund.unrealisedPnLPercent)}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-right">
          {fund.xirr !== null ? (
            <span className={fund.xirr >= 0 ? "text-emerald-400" : "text-red-400"}>
              {fund.xirr.toFixed(1)}%
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
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

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-secondary/20">
          <td colSpan={9} className="px-6 py-4">
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                Transaction History
              </p>
              <div className="space-y-0 max-h-64 overflow-y-auto">
                {fund.transactions.map((tx, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 py-2 border-b border-border/50 last:border-0 text-sm"
                  >
                    <div className="w-2 h-2 rounded-full bg-border flex-shrink-0 relative">
                      {i < fund.transactions.length - 1 && (
                        <div className="absolute top-2 left-[3px] w-[1px] h-[calc(100%+8px)] bg-border" />
                      )}
                    </div>
                    <span className="text-muted-foreground w-24 flex-shrink-0">
                      {format(new Date(tx.date), "d MMM yyyy")}
                    </span>
                    <span className={cn("w-24 font-medium", txColor(tx.type))}>
                      {txLabel(tx.type)}
                    </span>
                    <span className="text-foreground w-32">{formatCurrency(tx.amount)}</span>
                    <span className="text-muted-foreground">{formatUnits(tx.units)} units</span>
                    <span className="text-muted-foreground">@ ₹{formatNAV(tx.nav)}</span>
                  </div>
                ))}
              </div>
            </div>
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
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 px-6 py-4 border-b border-border">
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-6 w-24 ml-auto" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-24" />
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
      <CardContent className="p-0 overflow-x-auto">
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
      </CardContent>
    </Card>
  );
}
