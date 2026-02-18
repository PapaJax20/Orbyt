import * as React from "react";
import { cn } from "../../lib/utils";

interface OrbitalLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function OrbitalLoader({ size = "md", className }: OrbitalLoaderProps) {
  return (
    <div
      className={cn("orbital-ring animate-orbital-medium", sizeMap[size], className)}
      role="status"
      aria-label="Loading"
    />
  );
}
