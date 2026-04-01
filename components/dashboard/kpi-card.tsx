"use client";

import { useCountUp } from "./use-count-up";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: number;
  subtitle?: string;
  format?: "currency" | "percent" | "xirr";
  delta?: number;
  icon: LucideIcon;
  iconColor?: string;
  loading?: boolean;
}

export function KPICard({
  title,
  value,
  subtitle,
  format: fmt = "currency",
  delta,
  icon: Icon,
  iconColor = "text-primary",
  loading = false,
}: KPICardProps) {
  const animated = useCountUp(value);

  function display(v: number) {
    if (fmt === "percent") return formatPercent(v, 1);
    if (fmt === "xirr") return `${v.toFixed(1)}% p.a.`;
    return formatCurrency(v);
  }

  if (loading) {
    return (
      <Card className="p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-3 w-20" />
      </Card>
    );
  }

  return (
    <Card className="p-6 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground font-medium">{title}</span>
        <div className={cn("w-9 h-9 rounded-lg bg-secondary flex items-center justify-center", iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold tracking-tight">{display(animated)}</div>
      {subtitle && (
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      )}
      {delta !== undefined && (
        <div
          className={cn(
            "text-xs font-medium flex items-center gap-1",
            delta >= 0 ? "text-emerald-400" : "text-red-400"
          )}
        >
          <span>{delta >= 0 ? "↑" : "↓"}</span>
          <span>{Math.abs(delta).toFixed(1)}%</span>
        </div>
      )}
    </Card>
  );
}
