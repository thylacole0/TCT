import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { todayChile } from "../../../lib/dates";
import { resolveBudgetForExpense } from "../../../lib/budgets";

/**
 * POST /api/expenses/classify
 *
 * Called by Hermes Agent after classifying a pending expense notification.
 * Creates the real expense entry, links it to the budget, and marks the pending record as classified.
 *
 * Body: {
 *   pending_id: string,
 *   merchant: string,
 *   amount: number,
 *   description: string,
 *   category: string,
 *   subcategory?: string,
 *   expense_date?: string,   // YYYY-MM-DD, defaults to today
 *   budget_type?: 'comida' | 'aseo'
 * }
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    pending_id?: string;
    merchant?: string;
    amount?: number;
    description?: string;
    category?: string;
    subcategory?: string;
    expense_date?: string;
    budget_type?: "comida" | "aseo";
  };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!body.pending_id || !body.merchant || !body.amount || !body.description) {
    return new Response("pending_id, merchant, amount, and description are required", { status: 400 });
  }

  const supabase = createAuthClient(locals.accessToken);

  // Verify the pending expense belongs to this user and is still pending
  const { data: pendingRow, error: pendingError } = await supabase
    .from("pending_expenses")
    .select("id, status")
    .eq("id", body.pending_id)
    .eq("user_id", user.id)
    .single();

  if (pendingError || !pendingRow) {
    return new Response("Pending expense not found", { status: 404 });
  }

  if (pendingRow.status !== "pending") {
    return new Response(`Pending expense already ${pendingRow.status}`, { status: 409 });
  }

  const expenseDate = body.expense_date || todayChile();
  const category = body.category || "General";
  const budgetType = body.budget_type || null;

  // Resolve which budget this expense belongs to
  const resolvedBudget = await resolveBudgetForExpense(supabase, {
    budgetWeekId: null,
    budgetType,
    expenseDate,
  });

  // Full description: merchant + description
  const fullDescription = body.subcategory
    ? `${body.merchant} - ${body.subcategory}`
    : body.description;

  // Create the expense
  const { data: expense, error: expenseError } = await supabase
    .from("expenses")
    .insert({
      user_id: user.id,
      budget_week_id: resolvedBudget.budgetWeekId,
      budget_type: resolvedBudget.budgetType,
      amount: Math.round(body.amount),
      description: fullDescription,
      category,
      merchant: body.merchant,
      expense_date: expenseDate,
    })
    .select("id")
    .single();

  if (expenseError) {
    return new Response(expenseError.message, { status: 500 });
  }

  // Mark pending as classified
  const { error: updateError } = await supabase
    .from("pending_expenses")
    .update({
      status: "classified",
      merchant: body.merchant,
      amount: Math.round(body.amount),
      category,
      expense_date: expenseDate,
      classified_at: new Date().toISOString(),
    })
    .eq("id", body.pending_id);

  if (updateError) {
    // Non-fatal: expense was created but pending couldn't update
    console.error("Failed to update pending_expenses status:", updateError);
  }

  return new Response(
    JSON.stringify({ success: true, expense_id: expense.id }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
