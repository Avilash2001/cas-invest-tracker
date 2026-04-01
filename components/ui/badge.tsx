import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary border border-primary/20",
        equity: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
        debt: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
        hybrid: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
        gold: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
        international: "bg-purple-500/15 text-purple-400 border border-purple-500/20",
        positive: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
        negative: "bg-red-500/15 text-red-400 border border-red-500/20",
        secondary: "bg-secondary text-secondary-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
