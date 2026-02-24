"use client";

interface RecurrencePickerProps {
  value: string;
  onChange: (rrule: string) => void;
  referenceDate?: Date;
  className?: string;
}

const DAY_ABBRS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function stripRrulePrefix(value: string): string {
  return value.replace(/^RRULE:/i, "").trim();
}

function buildOptions(referenceDate?: Date): { value: string; label: string }[] {
  const date = referenceDate ?? new Date();
  const dayIndex = date.getDay();
  const dayName = DAY_NAMES[dayIndex];
  const dayAbbr = DAY_ABBRS[dayIndex];

  return [
    { value: "", label: "Does not repeat" },
    { value: "FREQ=DAILY", label: "Daily" },
    {
      value: `FREQ=WEEKLY;BYDAY=${dayAbbr}`,
      label: `Weekly on ${dayName}`,
    },
    { value: "FREQ=MONTHLY", label: "Monthly" },
    { value: "FREQ=YEARLY", label: "Annually" },
    {
      value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
      label: "Every weekday (Mon–Fri)",
    },
  ];
}

export function RecurrencePicker({
  value,
  onChange,
  referenceDate,
  className,
}: RecurrencePickerProps) {
  const normalized = stripRrulePrefix(value);
  const options = buildOptions(referenceDate);

  // Find the best-match option value for the current normalized value.
  // We compare normalized value against normalized option values for robustness.
  const matchedValue =
    options.find(
      (opt) =>
        opt.value === normalized ||
        stripRrulePrefix(opt.value) === normalized
    )?.value ?? normalized;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <select
      value={matchedValue}
      onChange={handleChange}
      className={`orbyt-input min-h-[44px]${className ? ` ${className}` : ""}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
      {/* If the current value isn't in the preset list, show it as a disabled option */}
      {normalized !== "" &&
        !options.some((opt) => opt.value === normalized) && (
          <option value={normalized} disabled>
            Custom rule
          </option>
        )}
    </select>
  );
}
