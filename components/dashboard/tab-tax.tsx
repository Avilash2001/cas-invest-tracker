"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertCircle, Scissors, Info } from "lucide-react";

interface TaxData {
  realised: {
    stcg: number;
    ltcg: number;
    stcgTax: number;
    ltcgTax: number;
    totalTax: number;
  };
  unrealised: {
    stcg: number;
    ltcg: number;
    stcgTax: number;
    ltcgTax: number;
    totalTax: number;
  };
  taxHarvestOpportunities: Array<{
    fundName: string;
    amfiCode: string;
    unrealisedLoss: number;
    currentValue: number;
  }>;
  constants: {
    stcgRate: number;
    ltcgRate: number;
    ltcgExemption: number;
  };
}

function GainRow({ label, value, tax, note }: {
  label: string;
  value: number;
  tax: number;
  note?: string;
}) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {note && <p className="text-xs text-muted-foreground mt-0.5">{note}</p>}
      </div>
      <div className="text-right">
        <p className={cn("text-sm font-semibold", value >= 0 ? "text-emerald-400" : "text-red-400")}>
          {formatCurrency(value)}
        </p>
        <p className="text-xs text-muted-foreground">Tax: {formatCurrency(tax)}</p>
      </div>
    </div>
  );
}

export function TaxTab() {
  const [data, setData] = useState<TaxData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portfolio/tax")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-32 mb-4" />
            <Skeleton className="h-32 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (!data) {
    return <Card className="p-12 text-center text-muted-foreground">No tax data available.</Card>;
  }

  return (
    <div className="space-y-6">
      {/* Rate info banner */}
      <div className="flex items-start gap-2 p-3 bg-secondary/60 rounded-lg text-xs text-muted-foreground border border-border">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
        <div>
          STCG (held &lt;1yr): {data.constants.stcgRate}% · LTCG (held ≥1yr): {data.constants.ltcgRate}% above ₹{formatCurrency(data.constants.ltcgExemption)} exemption.
          FY 2024–25 rates.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Realised */}
        <Card>
          <CardHeader>
            <CardTitle>Realised Gains / Losses</CardTitle>
          </CardHeader>
          <CardContent>
            <GainRow
              label="Short-Term Capital Gains"
              value={data.realised.stcg}
              tax={data.realised.stcgTax}
              note={`Taxable @${data.constants.stcgRate}%`}
            />
            <GainRow
              label="Long-Term Capital Gains"
              value={data.realised.ltcg}
              tax={data.realised.ltcgTax}
              note={`₹1.25L exempt, @${data.constants.ltcgRate}% above`}
            />
            <div className="flex items-center justify-between pt-3 border-t border-border mt-1">
              <p className="text-sm font-semibold">Total Tax Liability</p>
              <p className="text-base font-bold text-amber-400">
                {formatCurrency(data.realised.totalTax)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Unrealised */}
        <Card>
          <CardHeader>
            <CardTitle>Unrealised Gains (If Redeemed Today)</CardTitle>
          </CardHeader>
          <CardContent>
            <GainRow
              label="Unrealised STCG"
              value={data.unrealised.stcg}
              tax={data.unrealised.stcgTax}
            />
            <GainRow
              label="Unrealised LTCG"
              value={data.unrealised.ltcg}
              tax={data.unrealised.ltcgTax}
            />
            <div className="flex items-center justify-between pt-3 border-t border-border mt-1">
              <p className="text-sm font-semibold">Potential Tax Impact</p>
              <p className="text-base font-bold text-amber-400">
                {formatCurrency(data.unrealised.totalTax)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax harvesting */}
      {data.taxHarvestOpportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-amber-400" />
              Tax Harvesting Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              These funds have unrealised losses. Booking them now can offset gains and reduce your tax outflow.
            </p>
            <div className="space-y-3">
              {data.taxHarvestOpportunities.map((opp) => (
                <div
                  key={opp.amfiCode}
                  className="flex items-start justify-between p-3 bg-secondary/60 rounded-lg border border-border"
                >
                  <div>
                    <p className="text-sm font-medium leading-tight">{opp.fundName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Current value: {formatCurrency(opp.currentValue)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-sm font-semibold text-red-400">
                      {formatCurrency(opp.unrealisedLoss)}
                    </p>
                    <p className="text-xs text-muted-foreground">loss</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
