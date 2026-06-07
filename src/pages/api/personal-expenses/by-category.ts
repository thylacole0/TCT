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
 * Returns authenticated user's personal card expenses grouped by the five
 * approved personal-finance categories. This intentionally does NOT read
 * household expenses or expense_items.
 */
export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const from = fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)
    ? fromParam
    : formatDateCL(getMonthStartChile());

  const to = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)
    ? toParam
    : formatDateCL(getMonthEndChile());

  const supabase = createAuthClient(locals.accessToken);

  const { data, error } = await supabase
    .from("personal_expenses")
    .select("id, amount, merchant, description, category, expense_date, expense_time, created_at, source, card_last4")
    .eq("user_id", user.id)
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false })
    .order("expense_time", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const rows = (data as PersonalExpenseRow[]) || [];
  const categories = groupPersonalExpensesByCategory(rows);
  const totalSpent = rows.reduce((sum, row) => sum + Number(row.amount), 0);

  return new Response(
    JSON.stringify({ categories, total_spent: totalSpent, from, to }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
