import * as React from "react";
import { cn } from "../../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "orbyt-button-primary",
        accent: "orbyt-button-accent",
        ghost: "orbyt-button-ghost",
        destructive:
          "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-95 px-4 py-2.5",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 py-2.5",
        lg: "h-12 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

interface SpaceButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function SpaceButton({ className, variant, size, loading, children, disabled, ...props }: SpaceButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled ?? loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="orbital-ring h-4 w-4 animate-orbital-medium" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
