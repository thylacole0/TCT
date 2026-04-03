import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAuthClient(locals.accessToken);

  const formData = await request.formData();
  const weekStart = formData.get("week_start")?.toString();
  const budgetAmount = formData.get("budget_amount")?.toString();

  if (!weekStart || !budgetAmount) {
    return new Response("week_start and budget_amount required", { status: 400 });
  }

  // Upsert: if week already exists, update the amount
  const { error } = await supabase
    .from("budget_weeks")
    .upsert(
      {
        week_start: weekStart,
        budget_amount: parseFloat(budgetAmount),
        created_by: user.id,
      },
      { onConflict: "week_start" }
    );

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
