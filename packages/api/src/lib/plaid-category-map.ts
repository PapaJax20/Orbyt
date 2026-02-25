/**
 * Maps Plaid personal_finance_category primary to Orbyt transaction categories.
 * Orbyt categories: housing, transportation, food, utilities, insurance,
 * healthcare, entertainment, shopping, personal, education, savings, debt, income, other
 */
const CATEGORY_MAP: Record<string, string> = {
  INCOME: "income",
  TRANSFER_IN: "income",
  TRANSFER_OUT: "other",
  LOAN_PAYMENTS: "debt",
  BANK_FEES: "other",
  ENTERTAINMENT: "entertainment",
  FOOD_AND_DRINK: "food",
  GENERAL_MERCHANDISE: "shopping",
  GENERAL_SERVICES: "other",
  GOVERNMENT_AND_NON_PROFIT: "other",
  HOME_IMPROVEMENT: "housing",
  MEDICAL: "healthcare",
  PERSONAL_CARE: "personal",
  RENT_AND_UTILITIES: "utilities",
  TRANSPORTATION: "transportation",
  TRAVEL: "entertainment",
};

export function mapPlaidCategory(primary: string | null | undefined): string {
  if (!primary) return "other";
  return CATEGORY_MAP[primary] ?? "other";
}

export function mapPlaidTransactionType(
  primary: string | null | undefined,
  amount: number
): "income" | "expense" {
  if (primary === "INCOME" || primary === "TRANSFER_IN") return "income";
  // Plaid: negative amounts = money out (expense), positive = money in (income)
  return amount < 0 ? "expense" : "income";
}
