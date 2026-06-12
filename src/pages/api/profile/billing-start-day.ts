import type { APIRoute } from "astro";
import { createServiceClient } from "../../../lib/supabase";

/**
 * GET /api/profile/billing-start-day
 * PATCH /api/profile/billing-start-day
 *
 * Stores billing_start_day in the user's auth user_metadata (raw_user_meta_data)
 * to avoid requiring DDL on the profiles table.
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

  // Read from user_metadata (set on signup or via admin API)
  const bsd = (user.user_metadata as Record<string, unknown>)?.billing_start_day;
  const day = typeof bsd === "number" && bsd >= 1 && bsd <= 28 ? bsd : 1;

  return json({ billing_start_day: day });
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
    return json({ error: "billing_start_day debe estar entre 1 y 28" }, 400);
  }

  try {
    const adminClient = createServiceClient();
    const { data, error } = await adminClient.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...(user.user_metadata as Record<string, unknown>),
          billing_start_day: billingDay,
        },
      },
    );

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({ ok: true, billing_start_day: billingDay });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return json({ error: msg }, 500);
  }
};
