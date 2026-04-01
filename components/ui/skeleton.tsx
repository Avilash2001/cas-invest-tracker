import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton bg-muted animate-skeleton-pulse rounded", className)}
      {...props}
    />
  );
}

export { Skeleton };
