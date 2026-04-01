"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PortfolioTimeseries } from "@/components/charts/portfolio-timeseries";
import { ChartErrorBoundary } from "./error-card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { differenceInYears } from "date-fns";

interface TimeseriesPoint {
  month: string;
  date?: string;
  invested: number;
  value: number;
  returns: number;
}

interface SummaryData {
  totalInvested: number;
  currentValue: number;
  totalReturns: number;
  returnsPercent: number;
  xirr: number | null;
  hasFunds: boolean;
}

interface OverviewTabProps {
  summary: SummaryData | null;
  summaryLoading: boolean;
}

export function OverviewTab({ summary, summaryLoading }: OverviewTabProps) {
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portfolio/timeseries")
      .then((r) => r.json())
      .then((d) => {
        setTimeseries(d.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Estimate holding period for CAGR
  const firstPoint = timeseries[0];
  const holdingYears = firstPoint
    ? differenceInYears(new Date(), new Date(firstPoint.date ?? firstPoint.month))
    : 0;
  const cagr =
    summary && summary.totalInvested > 0 && holdingYears > 0
      ? (Math.pow(summary.currentValue / summary.totalInvested, 1 / holdingYears) - 1) * 100
      : null;

  const absoluteReturn =
    summary && summary.totalInvested > 0
      ? ((summary.currentValue - summary.totalInvested) / summary.totalInvested) * 100
      : null;

  return (
    <div className="space-y-6">
      {/* Portfolio Value Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Value Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartErrorBoundary fallbackTitle="Timeseries chart failed">
            <PortfolioTimeseries data={timeseries} loading={loading} />
          </ChartErrorBoundary>
        </CardContent>
      </Card>

      {/* Returns breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground mb-1">Absolute Return</p>
          {summaryLoading ? (
            <Skeleton className="h-8 w-32 mt-1" />
          ) : (
            <>
              <p
                className={`text-2xl font-bold ${
                  (absoluteReturn ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {absoluteReturn !== null ? formatPercent(absoluteReturn) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary ? formatCurrency(summary.totalReturns) : "—"} total gain/loss
              </p>
            </>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-sm text-muted-foreground mb-1">
            CAGR {holdingYears > 0 ? `(${holdingYears}Y)` : ""}
          </p>
          {summaryLoading ? (
            <Skeleton className="h-8 w-32 mt-1" />
          ) : (
            <>
              <p
                className={`text-2xl font-bold ${
                  (cagr ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {cagr !== null && holdingYears >= 1 ? formatPercent(cagr) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {holdingYears < 1 ? "CAGR requires 1+ year" : "Compounded annual"}
              </p>
            </>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-sm text-muted-foreground mb-1">XIRR</p>
          {summaryLoading ? (
            <Skeleton className="h-8 w-32 mt-1" />
          ) : (
            <>
              <p
                className={`text-2xl font-bold ${
                  (summary?.xirr ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {summary?.xirr !== null && summary?.xirr !== undefined
                  ? `${summary.xirr.toFixed(1)}% p.a.`
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Extended IRR (time-weighted)
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
