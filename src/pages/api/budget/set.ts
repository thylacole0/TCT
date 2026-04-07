import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (locals.userRole === 'admin') {
    return new Response("Admin is read-only", { status: 403 });
  }

  const supabase = createAuthClient(locals.accessToken);

  const formData = await request.formData();
  const weekStart = formData.get("week_start")?.toString();
  const budgetAmount = formData.get("budget_amount")?.toString();
  const budgetType = formData.get("budget_type")?.toString() || "comida";

  if (!weekStart || !budgetAmount) {
    return new Response("week_start and budget_amount required", { status: 400 });
  }

  if (budgetType !== "comida" && budgetType !== "aseo") {
    return new Response("budget_type must be comida or aseo", { status: 400 });
  }

  // Upsert: if week+type already exists, update the amount
  const { error } = await supabase
    .from("budget_weeks")
    .upsert(
      {
        week_start: weekStart,
        budget_amount: parseFloat(budgetAmount),
        budget_type: budgetType,
        created_by: user.id,
      },
      { onConflict: "week_start,budget_type" }
    );

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
