import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { isBudgetType, resolveBudgetForExpense } from "../../../lib/budgets";

export const PATCH: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (locals.userRole === "admin") {
    return new Response("Admin is read-only", { status: 403 });
  }

  const supabase = createAuthClient(locals.accessToken);

  try {
    const body = await request.json();
    const expenseId = typeof body.expense_id === "string" ? body.expense_id : "";
    const budgetType = body.budget_type;
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const expenseDate = typeof body.expense_date === "string" ? body.expense_date : "";

    if (!expenseId) {
      return new Response("expense_id required", { status: 400 });
    }
    if (!isBudgetType(budgetType)) {
      return new Response("Invalid budget_type", { status: 400 });
    }
    if (!category) {
      return new Response("category required", { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      return new Response("Invalid expense_date", { status: 400 });
    }

    const resolvedBudget = await resolveBudgetForExpense(supabase, {
      budgetType,
      expenseDate,
    });

    if (!resolvedBudget.budgetWeekId) {
      const label = budgetType === "aseo" ? "aseo" : "comida";
      return new Response(`No hay presupuesto de ${label} para esa fecha`, { status: 409 });
    }

    const { data, error } = await supabase.rpc("update_expense_classification", {
      p_expense_id: expenseId,
      p_budget_week_id: resolvedBudget.budgetWeekId,
      p_budget_type: budgetType,
      p_category: category,
      p_expense_date: expenseDate,
    });

    if (error) {
      const status = error.code === "42501" ? 403 : 500;
      return new Response(error.message, { status });
    }
    if (!data) {
      return new Response("Expense not found", { status: 404 });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(error.message || "Invalid request body", { status: 400 });
  }
};