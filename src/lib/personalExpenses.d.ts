export type PersonalExpenseCategory = 'Delivery' | 'Supermercado' | 'Transporte' | 'Gustos personales' | 'Gastos del hogar' | 'Suscripciones' | 'Otros';

export const CATEGORIES: readonly ['Delivery', 'Supermercado', 'Transporte', 'Gustos personales', 'Gastos del hogar', 'Suscripciones', 'Otros'];
export const CATEGORY_COLORS: Record<string, string>;
export const CATEGORY_ICONS: Record<string, any>;

export interface PersonalExpenseLike {
  id: string;
  amount: number;
  merchant?: string | null;
  description?: string | null;
  category: string;
  expense_date: string;
  expense_time?: string | null;
  created_at?: string | null;
}

export interface PersonalExpenseTransaction extends PersonalExpenseLike {
  category: PersonalExpenseCategory;
  display_time: string | null;
}

export interface PersonalExpenseCategoryGroup {
  category: PersonalExpenseCategory;
  total: number;
  count: number;
  transactions: PersonalExpenseTransaction[];
}

export function normalizePersonalExpenseCategory(category: string): PersonalExpenseCategory;
export function formatExpenseTime(expenseTime?: string | null, createdAt?: string | null): string | null;
export function groupPersonalExpensesByCategory(rows: PersonalExpenseLike[]): PersonalExpenseCategoryGroup[];
