"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DonutChart } from "@/components/charts/donut-chart";
import { ChartErrorBoundary } from "./error-card";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";

interface AllocationData {
  assetClass: Array<{ name: string; value: number; percent: number }>;
  marketCap: Array<{ name: string; value: number; percent: number }>;
  fundHouse: Array<{ name: string; value: number; percent: number }>;
  treemap: Array<{ name: string; value: number; category: string }>;
  total: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Equity: "#6366F1",
  Debt: "#10B981",
  Hybrid: "#F59E0B",
  Gold: "#EAB308",
  International: "#8B5CF6",
};

function TreemapTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number; category: string } }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg p-2 shadow text-xs">
      <p className="font-medium truncate max-w-[200px]">{d.name}</p>
      <p className="text-muted-foreground">{formatCurrency(d.value)}</p>
      <p style={{ color: CATEGORY_COLORS[d.category] ?? "#6366F1" }}>{d.category}</p>
    </div>
  );
}

function TreemapCell(props: {
  x?: number; y?: number; width?: number; height?: number;
  name?: string; category?: string; value?: number; depth?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, category, depth } = props;
  if (depth !== 1 || width < 5 || height < 5) return null;
  const color = CATEGORY_COLORS[category ?? ""] ?? "#6366F1";
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.7} stroke="hsl(var(--border))" strokeWidth={1} rx={4} />
      {width > 40 && height > 24 && (
        <text x={x + 6} y={y + 16} fontSize={10} fill="white" fontWeight={500}>
          {name && name.length > 20 ? name.slice(0, 18) + "…" : name}
        </text>
      )}
    </g>
  );
}

export function AllocationTab() {
  const [data, setData] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portfolio/allocation")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="h-48 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        No allocation data available.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 2x2 Donut grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card className="p-4">
          <ChartErrorBoundary>
            <DonutChart data={data.assetClass} title="Asset Class" />
          </ChartErrorBoundary>
        </Card>
        <Card className="p-4">
          <ChartErrorBoundary>
            <DonutChart
              data={data.marketCap.filter((d) => d.value > 0)}
              title="Market Cap (Equity)"
            />
          </ChartErrorBoundary>
        </Card>
        <Card className="p-4">
          <ChartErrorBoundary>
            <DonutChart data={data.fundHouse} title="Fund House" />
          </ChartErrorBoundary>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium text-muted-foreground mb-3">Equity vs Others</div>
          <ChartErrorBoundary>
            <DonutChart
              data={data.assetClass.map((d) => ({
                name: d.name,
                value: d.value,
                percent: d.percent,
              }))}
              title=""
            />
          </ChartErrorBoundary>
        </Card>
      </div>

      {/* Treemap */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings Treemap</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartErrorBoundary fallbackTitle="Treemap failed to render">
            <ResponsiveContainer width="100%" height={320}>
              <Treemap
                data={data.treemap}
                dataKey="value"
                animationDuration={800}
                content={<TreemapCell />}
              >
                <Tooltip content={<TreemapTooltip />} />
              </Treemap>
            </ResponsiveContainer>
          </ChartErrorBoundary>
        </CardContent>
      </Card>
    </div>
  );
}
