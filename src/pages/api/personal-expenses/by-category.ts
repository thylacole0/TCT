import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import {
  cycleKeyFromDate,
  getPersonalCycleBounds,
  normalizePersonalBillingCycle,
  nowChile,
} from "../../../lib/dates";
import { CATEGORIES, groupPersonalExpensesByCategory } from "../../../lib/personalExpenses.js";

interface PersonalExpenseRow {
  id: string;
  amount: number;
  merchant: string | null;
  description: string | null;
  category: string;
  expense_date: string;
  expense_time: string | null;
  created_at: string;
  source: string | null;
  card_last4: string | null;
}

interface CategoryGroup {
  category: string;
  total: number;
  count: number;
  transactions: unknown[];
}

interface InstallmentContribution {
  id: string;
  merchant: string;
  description: string | null;
  category: string;
  total_amount: number;
  monthly_amount: number;
  base_monthly_amount: number;
  current_installment: number;
  total_installments: number;
  start_month: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function monthDiff(fromMonth: string, toMonth: string): number {
  const [fy, fm] = fromMonth.split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

function installmentAmountForMonth(totalAmount: number, totalInstallments: number, currentInstallment: number): number {
  const base = Math.floor(totalAmount / totalInstallments);
  if (currentInstallment === totalInstallments) {
    return base + (totalAmount - base * totalInstallments);
  }
  return base;
}

function ensureCategory(categories: CategoryGroup[], category: string): CategoryGroup {
  let group = categories.find((g) => g.category === category);
  if (!group) {
    group = { category, total: 0, count: 0, transactions: [] };
    categories.push(group);
  }
  return group;
}

/**
 * GET /api/personal-expenses/by-category?month=YYYY-MM
 * GET /api/personal-expenses/by-category?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns authenticated user's personal card expenses grouped by category,
 * including installment contributions for the selected personal billing period.
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const userMeta = user.user_metadata as Record<string, unknown> | undefined;
  const billingCycle = normalizePersonalBillingCycle(userMeta?.personal_billing_cycle, userMeta?.billing_start_day);

  let resolvedCycleKey = monthParam && MONTH_RE.test(monthParam)
    ? monthParam
    : cycleKeyFromDate(nowChile(), billingCycle);
  let { from: resolvedFrom, to: resolvedTo } = getPersonalCycleBounds(resolvedCycleKey, billingCycle);

  if (fromParam && toParam && DATE_RE.test(fromParam) && DATE_RE.test(toParam)) {
    resolvedFrom = fromParam;
    resolvedTo = toParam;
    resolvedCycleKey = monthParam && MONTH_RE.test(monthParam) ? monthParam : resolvedTo.slice(0, 7);
  }

  const supabase = createAuthClient(locals.accessToken);

  const { data, error } = await supabase
    .from("personal_expenses")
    .select("id, amount, merchant, description, category, expense_date, expense_time, created_at, source, card_last4")
    .eq("user_id", user.id)
    .gte("expense_date", resolvedFrom)
    .lte("expense_date", resolvedTo)
    .order("expense_date", { ascending: false })
    .order("expense_time", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return json({ error: error.message }, 500);
  }

  const rows = (data as PersonalExpenseRow[]) || [];
  const categoryNames = Array.from(CATEGORIES as readonly string[]);
  const categories = groupPersonalExpensesByCategory(rows) as unknown as CategoryGroup[];
  for (const category of categoryNames) {
    ensureCategory(categories, category);
  }
  const transactionTotal = rows.reduce((sum, row) => sum + Number(row.amount), 0);

  const { data: installmentRows, error: instError } = await supabase
    .from("personal_installments")
    .select("id, merchant, description, total_amount, total_installments, monthly_amount, start_month, category, created_at")
    .eq("user_id", user.id)
    .lte("start_month", resolvedCycleKey)
    .order("created_at", { ascending: false });

  if (instError) {
    return json({ error: instError.message }, 500);
  }

  const installments: InstallmentContribution[] = [];
  let installmentTotal = 0;

  for (const inst of installmentRows || []) {
    const totalInstallments = Number(inst.total_installments) || 0;
    const totalAmount = Number(inst.total_amount) || 0;
    const elapsed = monthDiff(inst.start_month as string, resolvedCycleKey);

    if (elapsed >= 0 && elapsed < totalInstallments) {
      const currentInstallment = elapsed + 1;
      const baseAmount = Math.floor(totalAmount / totalInstallments);
      const amount = installmentAmountForMonth(totalAmount, totalInstallments, currentInstallment);
      const category = (inst.category as string) || "Otros";

      const group = ensureCategory(categories, category);
      group.total += amount;
      group.count += 1;
      installmentTotal += amount;

      installments.push({
        id: inst.id as string,
        merchant: (inst.merchant as string) || "",
        description: (inst.description as string) || null,
        category,
        total_amount: totalAmount,
        monthly_amount: amount,
        base_monthly_amount: baseAmount,
        current_installment: currentInstallment,
        total_installments: totalInstallments,
        start_month: inst.start_month as string,
      });
    }
  }

  const orderedCategories = categoryNames.map((category) => ensureCategory(categories, category));
  const extras = categories.filter((group) => !categoryNames.includes(group.category));
  const totalSpent = transactionTotal + installmentTotal;

  return json({
    categories: [...orderedCategories, ...extras],
    total_spent: totalSpent,
    transaction_total: transactionTotal,
    installment_total: installmentTotal,
    from: resolvedFrom,
    to: resolvedTo,
    cycle_key: resolvedCycleKey,
    billing_start_day: typeof billingCycle.start_day === "number" ? billingCycle.start_day : 1,
    billing_end_day: billingCycle.end_day,
    billing_cycle: billingCycle,
    installments,
  });
};
