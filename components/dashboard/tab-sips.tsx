"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Repeat, TrendingUp } from "lucide-react";

interface SIPData {
  amfiCode: string;
  schemeName: string;
  monthlyAmount: number;
  dayOfMonth: number;
  sipStartDate: string;
  totalInvested: number;
  currentValue: number;
  monthsElapsed: number;
  targetMonths: number;
  projections: { at12: number; at15: number; at18: number };
}

function SIPCard({ sip }: { sip: SIPData }) {
  const progress = Math.min(100, (sip.monthsElapsed / sip.targetMonths) * 100);
  const gain = sip.currentValue - sip.totalInvested;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
          <Repeat className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight truncate">{sip.schemeName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Started {format(parseISO(sip.sipStartDate), "MMM yyyy")} · Day {sip.dayOfMonth} monthly
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold">{formatCurrency(sip.monthlyAmount)}</p>
          <p className="text-xs text-muted-foreground">/ month</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Invested</p>
          <p className="font-medium">{formatCurrency(sip.totalInvested)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Current Value</p>
          <p className={cn("font-medium", gain >= 0 ? "text-emerald-400" : "text-red-400")}>
            {formatCurrency(sip.currentValue)}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>{sip.monthsElapsed} months elapsed</span>
          <span>{sip.targetMonths - sip.monthsElapsed} remaining</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Projections */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
          <TrendingUp className="w-3.5 h-3.5" />
          Projected Corpus
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { rate: "12%", value: sip.projections.at12 },
            { rate: "15%", value: sip.projections.at15 },
            { rate: "18%", value: sip.projections.at18 },
          ].map(({ rate, value }) => (
            <div key={rate} className="bg-secondary/60 rounded-lg p-2 text-center">
              <p className="text-[10px] text-muted-foreground">{rate} CAGR</p>
              <p className="text-xs font-semibold mt-0.5">{formatCurrency(value, true)}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function SIPHeatmap({ calendar }: { calendar: Record<string, number> }) {
  // Build last 52 weeks
  const today = new Date();
  const weeks: Array<Array<{ date: string; value: number }>> = [];
  let current = new Date(today);
  current.setDate(current.getDate() - current.getDay()); // start of week (Sunday)

  for (let w = 0; w < 52; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateKey = format(current, "yyyy-MM-dd");
      week.push({ date: dateKey, value: calendar[dateKey] ?? 0 });
      current.setDate(current.getDate() + 1);
    }
    weeks.unshift(week);
    current.setDate(current.getDate() - 14); // back 2 weeks (7 forward + 7 back)
  }

  const maxVal = Math.max(...Object.values(calendar), 1);

  function getColor(value: number) {
    if (value === 0) return "bg-secondary";
    const intensity = Math.min(1, value / maxVal);
    if (intensity < 0.25) return "bg-indigo-500/30";
    if (intensity < 0.5) return "bg-indigo-500/50";
    if (intensity < 0.75) return "bg-indigo-500/70";
    return "bg-indigo-500";
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                className={cn("w-3 h-3 rounded-sm transition-colors", getColor(day.value))}
                title={day.value > 0 ? `${day.date}: ${formatCurrency(day.value)}` : day.date}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SIPsTab() {
  const [sips, setSips] = useState<SIPData[]>([]);
  const [calendar, setCalendar] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portfolio/sips")
      .then((r) => r.json())
      .then((d) => {
        setSips(d.sips ?? []);
        setCalendar(d.sipCalendar ?? {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-32 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sips.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          No active SIPs detected. SIPs are identified when a fund has 3+ purchases on the same day each month.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sips.map((sip) => (
            <SIPCard key={sip.amfiCode} sip={sip} />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>SIP Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Contribution activity over the last 12 months
          </p>
          <SIPHeatmap calendar={calendar} />
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="w-3 h-3 rounded-sm bg-secondary" />
            <div className="w-3 h-3 rounded-sm bg-indigo-500/30" />
            <div className="w-3 h-3 rounded-sm bg-indigo-500/50" />
            <div className="w-3 h-3 rounded-sm bg-indigo-500/70" />
            <div className="w-3 h-3 rounded-sm bg-indigo-500" />
            <span>More</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
