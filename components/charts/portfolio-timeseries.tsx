"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

interface DataPoint {
  month: string;
  invested: number;
  value: number;
  returns: number;
}

interface PortfolioTimeseriesProps {
  data: DataPoint[];
  loading?: boolean;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-medium text-foreground">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function PortfolioTimeseries({ data, loading }: PortfolioTimeseriesProps) {
  if (loading) {
    return <Skeleton className="w-full h-80" />;
  }

  // Show at most 36 data points for readability
  const displayData = data.length > 36 ? data.slice(-36) : data;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart data={displayData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => {
            if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
            if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
            if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
            return String(v);
          }}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }}
          formatter={(value) => (
            <span style={{ color: "hsl(var(--muted-foreground))" }}>
              {value === "invested" ? "Invested" : "Current Value"}
            </span>
          )}
        />
        <Area
          type="monotone"
          dataKey="invested"
          stroke="#6366F1"
          strokeWidth={2}
          fill="url(#investedGrad)"
          animationDuration={800}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#8B5CF6"
          strokeWidth={2}
          fill="url(#valueGrad)"
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
