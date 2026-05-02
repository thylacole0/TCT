import { formatDateCL, getMondayChile, getMonthStartChile } from "./dates";

export type BudgetType = "comida" | "aseo";

type SupabaseLike = any;

export function isBudgetType(value: unknown): value is BudgetType {
  return value === "comida" || value === "aseo";
}

export function getBudgetPeriodStartForDate(budgetType: BudgetType, dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  return budgetType === "aseo"
    ? formatDateCL(getMonthStartChile(date))
    : formatDateCL(getMondayChile(date));
}

export function getBudgetPeriodEnd(budgetType: BudgetType, periodStartStr: string): string {
  const end = new Date(`${periodStartStr}T12:00:00`);
  if (budgetType === "aseo") {
    end.setMonth(end.getMonth() + 1, 0);
  } else {
    end.setDate(end.getDate() + 6);
  }
  return formatDateCL(end);
}

export async function resolveBudgetForExpense(
  supabase: SupabaseLike,
  options: {
    budgetWeekId?: string | null;
    budgetType?: string | null;
    expenseDate: string;
  }
): Promise<{ budgetWeekId: string | null; budgetType: BudgetType | null }> {
  let budgetType = isBudgetType(options.budgetType) ? options.budgetType : null;

  if (options.budgetWeekId) {
    if (!budgetType) {
      const { data } = await supabase
        .from("budget_weeks")
        .select("budget_type")
        .eq("id", options.budgetWeekId)
        .maybeSingle();
      budgetType = isBudgetType(data?.budget_type) ? data.budget_type : null;
    }

    return { budgetWeekId: options.budgetWeekId, budgetType };
  }

  if (!budgetType) {
    return { budgetWeekId: null, budgetType: null };
  }

  const periodStart = getBudgetPeriodStartForDate(budgetType, options.expenseDate);
  const { data } = await supabase
    .from("budget_weeks")
    .select("id")
    .eq("week_start", periodStart)
    .eq("budget_type", budgetType)
    .maybeSingle();

  return { budgetWeekId: data?.id ?? null, budgetType };
}

export async function linkExistingExpensesToBudget(
  supabase: SupabaseLike,
  options: {
    budgetId: string;
    budgetType: BudgetType;
    periodStart: string;
  }
): Promise<number> {
  const periodEnd = getBudgetPeriodEnd(options.budgetType, options.periodStart);

  const { error, count } = await supabase
    .from("expenses")
    .update(
      { budget_week_id: options.budgetId, budget_type: options.budgetType },
      { count: "exact" }
    )
    .is("budget_week_id", null)
    .gte("expense_date", options.periodStart)
    .lte("expense_date", periodEnd)
    .or(`budget_type.eq.${options.budgetType},budget_type.is.null`);

  if (error) throw error;
  return count ?? 0;
}
