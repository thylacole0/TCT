import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAuthClient(locals.accessToken);

  const formData = await request.formData();
  const amount = formData.get("amount")?.toString();
  const description = formData.get("description")?.toString();
  const category = formData.get("category")?.toString() || "Supermercado";
  const expenseDate = formData.get("expense_date")?.toString() || new Date().toISOString().split('T')[0];
  const budgetWeekId = formData.get("budget_week_id")?.toString();

  if (!amount || !description) {
    return new Response("amount and description required", { status: 400 });
  }

  const { error } = await supabase.from("expenses").insert({
    budget_week_id: budgetWeekId || null,
    user_id: user.id,
    amount: parseFloat(amount),
    description,
    category,
    expense_date: expenseDate,
  });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
