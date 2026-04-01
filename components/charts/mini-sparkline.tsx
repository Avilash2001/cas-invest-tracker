"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

export function MiniSparkline({ data, color = "#6366F1", height = 36 }: SparklineProps) {
  const chartData = data.map((value, i) => ({ i, value }));
  return (
    <ResponsiveContainer width={80} height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          animationDuration={600}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
