"use client";

import { useState, useEffect } from "react";

interface CategorySelectProps {
  value: string;
  onChange: (category: string) => void;
  presets: { value: string; label: string; icon?: string }[];
  customCategories?: string[];
  label?: string;
  id?: string;
  className?: string;
}

const OTHER_VALUE = "__other__";

function buildOptions(
  presets: { value: string; label: string; icon?: string }[],
  customCategories: string[]
): { value: string; label: string }[] {
  const presetValues = new Set(presets.map((p) => p.value));

  // Custom categories not already covered by presets
  const extraCustom = customCategories.filter((c) => !presetValues.has(c));

  const merged: { value: string; label: string }[] = [
    ...presets.map((p) => ({
      value: p.value,
      label: p.icon ? `${p.icon} ${p.label}` : p.label,
    })),
    ...extraCustom.map((c) => ({ value: c, label: c })),
    { value: OTHER_VALUE, label: "Other..." },
  ];

  return merged;
}

export function CategorySelect({
  value,
  onChange,
  presets,
  customCategories = [],
  label,
  id,
  className,
}: CategorySelectProps) {
  const options = buildOptions(presets, customCategories);

  // Determine if the current value is a known option (excluding OTHER_VALUE sentinel)
  const isKnownOption = options.some(
    (opt) => opt.value === value && opt.value !== OTHER_VALUE
  );
  const isCustomInput = !isKnownOption && value !== "";

  const [showCustomInput, setShowCustomInput] = useState<boolean>(
    isCustomInput
  );
  const [customText, setCustomText] = useState<string>(
    isCustomInput ? value : ""
  );

  // Keep showCustomInput in sync when value changes externally (e.g., edit mode)
  useEffect(() => {
    const known = options.some(
      (opt) => opt.value === value && opt.value !== OTHER_VALUE
    );
    if (!known && value !== "") {
      setShowCustomInput(true);
      setCustomText(value);
    } else if (known) {
      setShowCustomInput(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // The select value: if we're showing custom input, highlight "Other..."
  const selectValue = showCustomInput ? OTHER_VALUE : value;

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === OTHER_VALUE) {
      setShowCustomInput(true);
      setCustomText("");
      // Don't call onChange yet — wait for the user to type
    } else {
      setShowCustomInput(false);
      setCustomText("");
      onChange(selected);
    }
  };

  const handleCustomTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setCustomText(text);
    onChange(text);
  };

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-text mb-1"
        >
          {label}
        </label>
      )}
      <select
        id={id}
        value={selectValue}
        onChange={handleSelectChange}
        className="orbyt-input min-h-[44px] w-full"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {showCustomInput && (
        <input
          type="text"
          value={customText}
          onChange={handleCustomTextChange}
          placeholder="Enter custom category"
          maxLength={50}
          className="orbyt-input min-h-[44px] w-full mt-2"
          aria-label="Custom category"
        />
      )}
    </div>
  );
}
