"use client";

interface DayOfMonthPickerProps {
  value: number;
  onChange: (day: number) => void;
  className?: string;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export function DayOfMonthPicker({
  value,
  onChange,
  className,
}: DayOfMonthPickerProps) {
  return (
    <div
      className={`rounded-xl border border-border p-2${className ? ` ${className}` : ""}`}
    >
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((day) => {
          const isSelected = day === value;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onChange(day)}
              aria-label={`Day ${day}`}
              aria-pressed={isSelected}
              className={
                `rounded-lg min-h-[44px] text-sm font-medium transition-colors w-full` +
                (isSelected
                  ? " ring-2 ring-accent bg-accent/15 text-accent font-semibold"
                  : " bg-surface/50 text-text hover:bg-surface hover:text-accent")
              }
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
