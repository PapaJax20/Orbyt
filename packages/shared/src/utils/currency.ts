/**
 * Format a numeric amount as currency string.
 */
export function formatCurrency(
  amount: number | string,
  currency = "USD",
  locale = "en-US"
): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Parse a currency string to a number.
 */
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]/g, ""));
}

/**
 * Sum an array of numeric strings (bill amounts).
 */
export function sumAmounts(amounts: (string | number)[]): number {
  return amounts.reduce<number>((acc, val) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return acc + (isNaN(num) ? 0 : num);
  }, 0);
}
