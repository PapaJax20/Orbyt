"use client";

import { useState, useCallback } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NlpEventInputProps {
  onParsed: (parsed: {
    title: string;
    startAt: string;
    endAt: string | null;
    allDay: boolean;
  }) => void;
}

// ── NlpEventInput ─────────────────────────────────────────────────────────────

export function NlpEventInput({ onParsed }: NlpEventInputProps) {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const utils = trpc.useUtils();

  const handleSubmit = useCallback(
    async (e: React.FormEvent | React.KeyboardEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      try {
        const result = await utils.calendar.parseNaturalLanguageDate.fetch({
          text: trimmed,
          referenceDate: new Date().toISOString(),
        });

        if (result.success) {
          onParsed(result.parsed);
          setText("");
        } else {
          toast.error(result.message);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to parse event text";
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [text, isLoading, utils, onParsed],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleSubmit(e);
      }
    },
    [handleSubmit],
  );

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        <Wand2
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent"
          aria-hidden="true"
        />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder='Quick add: "Dentist tomorrow 3pm"'
          aria-label="Quick add event using natural language"
          className="orbyt-input w-full pl-10 pr-28"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs text-text-muted">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
          ) : (
            "Enter to add"
          )}
        </span>
      </div>
    </form>
  );
}
