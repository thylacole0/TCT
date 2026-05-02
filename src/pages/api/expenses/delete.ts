import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

export const DELETE: APIRoute = async ({ request, locals }) => {
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

    if (!expenseId) {
      return new Response("expense_id required", { status: 400 });
    }

    const { data, error } = await supabase.rpc("delete_expense", {
      p_expense_id: expenseId,
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