"use client";

import Image from "next/image";

type Character = "rosie" | "eddie";
type Expression = "happy" | "winking" | "thinking" | "concerned" | "celebrating";

interface EmptyStateProps {
  character?: Character;
  expression?: Expression;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({
  character = "rosie",
  expression = "happy",
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  const src = `/characters/${character}/full-body-${expression}.svg`;

  return (
    <div
      className={
        compact
          ? "flex flex-col items-center justify-center py-6 px-4 text-center"
          : "flex flex-col items-center justify-center py-16 px-6 text-center"
      }
    >
      <div className={compact ? "mb-3 opacity-90" : "mb-6 opacity-90"}>
        <Image
          src={src}
          alt={`${character} ${expression}`}
          width={compact ? 80 : 200}
          height={compact ? 120 : 300}
          className="object-contain"
          priority={false}
        />
      </div>

      <h3
        className={
          compact
            ? "text-sm font-medium text-text mb-1"
            : "text-xl font-semibold text-text mb-2"
        }
      >
        {title}
      </h3>

      {description && (
        <p
          className={
            compact
              ? "text-xs text-text-secondary max-w-xs"
              : "text-sm text-text-secondary max-w-xs mb-6"
          }
        >
          {description}
        </p>
      )}

      {!compact && actionLabel && onAction && (
        <button
          onClick={onAction}
          className="orbyt-button-accent"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
