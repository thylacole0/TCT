export const CATEGORIES: readonly ['Delivery', 'Supermercado', 'Transporte', 'Gustos personales', 'Otros'];

export interface PersonalExpenseLike {
  id: string;
  amount: number;
  merchant?: string | null;
  description?: string | null;
  category: string;
  expense_date: string;
  expense_time?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface PersonalExpenseTransaction extends PersonalExpenseLike {
  category: 'Delivery' | 'Supermercado' | 'Transporte' | 'Gustos personales' | 'Otros';
  display_time: string | null;
}

export interface PersonalExpenseCategoryGroup {
  category: 'Delivery' | 'Supermercado' | 'Transporte' | 'Gustos personales' | 'Otros';
  total: number;
  count: number;
  transactions: PersonalExpenseTransaction[];
}

export function normalizePersonalExpenseCategory(category: string): 'Delivery' | 'Supermercado' | 'Transporte' | 'Gustos personales' | 'Otros';
export function formatExpenseTime(expenseTime?: string | null, createdAt?: string | null): string | null;
export function groupPersonalExpensesByCategory(rows: PersonalExpenseLike[]): PersonalExpenseCategoryGroup[];
