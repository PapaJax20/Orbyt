import * as React from "react";
import { cn } from "../../lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
  as?: React.ElementType;
}

export function GlassCard({
  className,
  hover = false,
  glow = false,
  as: Component = "div",
  ...props
}: GlassCardProps) {
  return (
    <Component
      className={cn(
        "glass-card",
        hover && "glass-card-hover",
        glow && "shadow-[0_0_20px_rgba(0,212,255,0.15)]",
        className
      )}
      {...props}
    />
  );
}
