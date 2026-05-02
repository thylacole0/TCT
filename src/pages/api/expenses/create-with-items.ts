import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { todayChile } from "../../../lib/dates";
import { resolveBudgetForExpense } from "../../../lib/budgets";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (locals.userRole === 'admin') {
    return new Response("Admin is read-only", { status: 403 });
  }

  const supabase = createAuthClient(locals.accessToken);

  try {
    const body = await request.json();
    const { category, expense_date, budget_week_id, budget_type, items } = body;
    const expenseDate = expense_date || todayChile();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response("items array required", { status: 400 });
    }

    const resolvedBudget = await resolveBudgetForExpense(supabase, {
      budgetWeekId: budget_week_id || null,
      budgetType: budget_type || null,
      expenseDate,
    });

    // Calculate total from items
    const total = items.reduce(
      (sum: number, item: any) => sum + item.quantity * item.unit_price,
      0
    );

    // Create the expense
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        budget_week_id: resolvedBudget.budgetWeekId,
        budget_type: resolvedBudget.budgetType,
        user_id: user.id,
        amount: total,
        description: `${items.length} producto${items.length > 1 ? "s" : ""}`,
        category: category || "Supermercado",
        expense_date: expenseDate,
      })
      .select("id")
      .single();

    if (expenseError || !expense) {
      return new Response(expenseError?.message || "Error creating expense", {
        status: 500,
      });
    }

    // Create expense items
    const expenseItems = items.map((item: any) => ({
      expense_id: expense.id,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await supabase
      .from("expense_items")
      .insert(expenseItems);

    if (itemsError) {
      return new Response(itemsError.message, { status: 500 });
    }

    return new Response(
      JSON.stringify({ success: true, expense_id: expense.id, total }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(e.message || "Invalid request body", { status: 400 });
  }
};
