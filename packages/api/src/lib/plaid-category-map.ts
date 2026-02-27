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

const INCOME_CATEGORIES = new Set(["INCOME", "TRANSFER_IN"]);
const EXPENSE_CATEGORIES = new Set([
  "TRANSFER_OUT", "LOAN_PAYMENTS", "BANK_FEES", "ENTERTAINMENT",
  "FOOD_AND_DRINK", "GENERAL_MERCHANDISE", "GENERAL_SERVICES",
  "GOVERNMENT_AND_NON_PROFIT", "HOME_IMPROVEMENT", "MEDICAL",
  "PERSONAL_CARE", "RENT_AND_UTILITIES", "TRANSPORTATION", "TRAVEL",
]);

export function mapPlaidTransactionType(
  primary: string | null | undefined,
  amount: number
): "income" | "expense" {
  if (primary && INCOME_CATEGORIES.has(primary)) return "income";
  if (primary && EXPENSE_CATEGORIES.has(primary)) return "expense";
  // Fallback: Plaid positive = money out (expense), negative = money in (income)
  return amount > 0 ? "expense" : "income";
}
