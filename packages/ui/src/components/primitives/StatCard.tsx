import * as React from "react";
import { cn } from "../../lib/utils";

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
}

export function StatCard({ title, value, subtitle, icon, trend, className, ...props }: StatCardProps) {
  return (
    <div className={cn("glass-card flex flex-col gap-3 p-5", className)} {...props}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-text-muted">{title}</p>
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
            {icon}
          </div>
        )}
      </div>
      <div>
        <p className="font-display text-2xl font-bold text-text">{value}</p>
        {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
      </div>
      {trend && (
        <div className="flex items-center gap-1">
          <span className={cn("text-xs font-medium", trend.value >= 0 ? "text-green-400" : "text-red-400")}>
            {trend.value >= 0 ? "+" : ""}
            {trend.value}%
          </span>
          <span className="text-xs text-text-muted">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
