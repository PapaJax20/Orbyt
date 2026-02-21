"use client";

export function useHouseholdId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("orbyt-household-id");
}
