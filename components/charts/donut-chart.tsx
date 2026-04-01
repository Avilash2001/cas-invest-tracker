"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/format";

const COLORS = [
  "#6366F1", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444",
  "#3B82F6", "#EC4899", "#14B8A6", "#F97316", "#A855F7",
];

interface DonutDataPoint {
  name: string;
  value: number;
  percent: number;
}

interface DonutChartProps {
  data: DonutDataPoint[];
  title: string;
  innerLabel?: string;
}

function CustomTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: DonutDataPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-card border border-border rounded-lg p-2.5 shadow-lg text-xs">
      <p className="font-semibold">{d.name}</p>
      <p className="text-muted-foreground">{formatCurrency(d.value)}</p>
      <p className="text-primary">{d.payload.percent.toFixed(1)}%</p>
    </div>
  );
}

export function DonutChart({ data, title }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            animationDuration={800}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "11px" }}
            formatter={(value) => (
              <span style={{ color: "hsl(var(--muted-foreground))" }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground text-center">
        Total: {formatCurrency(total)}
      </p>
    </div>
  );
}
