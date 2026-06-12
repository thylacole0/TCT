import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

/**
 * GET /api/profile/billing-start-day
 * Returns the authenticated user's billing_start_day (default 1).
 *
 * PATCH /api/profile/billing-start-day
 * Body: { billing_start_day: number }
 * Updates the user's billing cycle start day.
 */
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createAuthClient(locals.accessToken);
  const { data, error } = await supabase
    .from("profiles")
    .select("billing_start_day")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // Column may not exist yet — return default
    if (error.code === "42703" || String(error.message).includes("does not exist")) {
      return json({ billing_start_day: 1 });
    }
    return json({ error: error.message }, 500);
  }

  return json({ billing_start_day: data?.billing_start_day ?? 1 });
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { billing_start_day?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const raw = Number(body.billing_start_day);
  const billingDay = Number.isFinite(raw) ? Math.round(raw) : NaN;

  if (!Number.isFinite(billingDay) || billingDay < 1 || billingDay > 28) {
    return json({ error: "billing_start_day must be between 1 and 28" }, 400);
  }

  const supabase = createAuthClient(locals.accessToken);
  const { error } = await supabase
    .from("profiles")
    .update({ billing_start_day: billingDay })
    .eq("id", user.id);

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ ok: true, billing_start_day: billingDay });
};
