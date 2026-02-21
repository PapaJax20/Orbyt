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
}

export function EmptyState({
  character = "rosie",
  expression = "happy",
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const src = `/characters/${character}/full-body-${expression}.svg`;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="mb-6 opacity-90">
        <Image
          src={src}
          alt={`${character} ${expression}`}
          width={200}
          height={300}
          className="object-contain"
          priority={false}
        />
      </div>

      <h3 className="text-xl font-semibold text-text mb-2">{title}</h3>

      {description && (
        <p className="text-sm text-text-secondary max-w-xs mb-6">{description}</p>
      )}

      {actionLabel && onAction && (
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
