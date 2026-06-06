import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { getMonthStartChile, getMonthEndChile, formatDateCL } from "../../../lib/dates";

interface ExpenseRow {
  id: string;
  amount: number;
  description: string;
  category: string;
  merchant: string | null;
  expense_date: string;
  created_at: string;
}

/**
 * GET /api/expenses/by-merchant?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns expenses grouped by merchant for the authenticated user,
 * within the optional date range (defaults to current month).
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  let from: string;
  let to: string;

  if (fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)) {
    from = fromParam;
  } else {
    from = formatDateCL(getMonthStartChile());
  }

  if (toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
    to = toParam;
  } else {
    to = formatDateCL(getMonthEndChile());
  }

  const supabase = createAuthClient(locals.accessToken);

  const { data, error } = await supabase
    .from("expenses")
    .select("id, amount, description, category, merchant, expense_date, created_at")
    .eq("user_id", user.id)
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const rows = (data as ExpenseRow[]) || [];

  // Group by merchant (use "Sin comercio" for null)
  const merchantMap = new Map<string, { total: number; count: number; transactions: ExpenseRow[] }>();

  for (const row of rows) {
    const key = row.merchant || "Sin comercio";
    if (!merchantMap.has(key)) {
      merchantMap.set(key, { total: 0, count: 0, transactions: [] });
    }
    const group = merchantMap.get(key)!;
    group.total += Number(row.amount);
    group.count += 1;
    group.transactions.push(row);
  }

  // Sort merchants by total descending
  const merchants = Array.from(merchantMap.entries())
    .map(([merchant, data]) => ({ merchant, ...data }))
    .sort((a, b) => b.total - a.total);

  const totalSpent = rows.reduce((sum, r) => sum + Number(r.amount), 0);

  return new Response(
    JSON.stringify({ merchants, total_spent: totalSpent, from, to }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
