import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { getMonthStartChile, getMonthEndChile, formatDateCL } from "../../../lib/dates";
import { groupPersonalExpensesByCategory } from "../../../lib/personalExpenses.js";

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

/**
 * GET /api/personal-expenses/by-category?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns authenticated user's personal card expenses grouped by category,
 * including installment contributions for the period.
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  // Read billing_start_day from user_metadata
  const userMeta = user.user_metadata as Record<string, unknown> | undefined;
  let billingStartDay = 1;
  const rawBsd = userMeta?.billing_start_day;
  if (typeof rawBsd === "number" && rawBsd >= 1 && rawBsd <= 28) {
    billingStartDay = rawBsd;
  }

  const resolvedFrom = fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)
    ? fromParam
    : formatDateCL(getMonthStartChile(undefined, billingStartDay));

  const resolvedTo = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)
    ? toParam
    : formatDateCL(getMonthEndChile(undefined, billingStartDay));

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
    return new Response(error.message, { status: 500 });
  }

  const rows = (data as PersonalExpenseRow[]) || [];
  const categories = groupPersonalExpensesByCategory(rows);
  const transactionTotal = rows.reduce((sum, row) => sum + Number(row.amount), 0);

  // Fetch installments active in this period
  const { data: installmentRows, error: instError } = await supabase
    .from("personal_installments")
    .select("id, merchant, description, total_amount, total_installments, monthly_amount, start_month, category, created_at")
    .eq("user_id", user.id)
    .lte("start_month", resolvedFrom.slice(0, 7)) // started on or before this period
    .order("created_at", { ascending: false });

  const installments: InstallmentContribution[] = [];
  let installmentTotal = 0;

  if (!instError && installmentRows) {
    const periodStart = resolvedFrom.slice(0, 7); // YYYY-MM
    for (const inst of installmentRows) {
      // Calculate which months this installment covers
      const startParts = (inst.start_month as string).split("-").map(Number);
      const startYear = startParts[0];
      const startMonth = startParts[1]; // 1-indexed

      const periodParts = periodStart.split("-").map(Number);
      const periodYear = periodParts[0];
      const periodMonth = periodParts[1]; // 1-indexed

      // Months elapsed since start
      const monthsElapsed = (periodYear - startYear) * 12 + (periodMonth - startMonth);

      // Check if this installment is active in the current period
      if (monthsElapsed >= 0 && monthsElapsed < inst.total_installments) {
        const amount = Number(inst.monthly_amount) || 0;
        const cat = (inst.category as string) || "Otros";

        // Add to running total for this category
        const catGroup = categories.find((g) => g.category === cat);
        if (catGroup) {
          catGroup.total += amount;
          catGroup.count += 1;
        }

        installmentTotal += amount;
        installments.push({
          id: inst.id as string,
          merchant: (inst.merchant as string) || "",
          description: (inst.description as string) || null,
          category: cat,
          monthly_amount: amount,
          current_installment: monthsElapsed + 1,
          total_installments: inst.total_installments as number,
          start_month: inst.start_month as string,
        });
      }
    }
  }

  const totalSpent = transactionTotal + installmentTotal;

  return new Response(
    JSON.stringify({
      categories,
      total_spent: totalSpent,
      transaction_total: transactionTotal,
      installment_total: installmentTotal,
      from: resolvedFrom,
      to: resolvedTo,
      billing_start_day: billingStartDay,
      installments,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

interface InstallmentContribution {
  id: string;
  merchant: string;
  description: string | null;
  category: string;
  monthly_amount: number;
  current_installment: number;
  total_installments: number;
  start_month: string;
}
