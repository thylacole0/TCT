import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { getFreshUserMetadata } from "../../../lib/userMetadata";
import {
  normalizePersonalBillingCycle,
  type BillingCycleDay,
  type PersonalBillingCycle,
} from "../../../lib/dates";

/**
 * GET /api/profile/billing-start-day
 * PATCH /api/profile/billing-start-day
 *
 * Backward-compatible endpoint for the personal finance billing cycle.
 * New shape is stored in user_metadata.personal_billing_cycle.
 * Legacy billing_start_day is still returned/written for older callers.
 */

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseCycleDay(value: unknown): BillingCycleDay | null {
  if (value === "last") return "last";
  if (typeof value === "string" && value.trim().toLowerCase() === "last") return "last";
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  const day = Math.round(raw);
  return day >= 1 && day <= 31 ? day : null;
}

function legacyStartDay(cycle: PersonalBillingCycle): number {
  return typeof cycle.start_day === "number" ? cycle.start_day : 1;
}

function cycleResponse(cycle: PersonalBillingCycle) {
  return {
    billing_start_day: legacyStartDay(cycle),
    billing_end_day: cycle.end_day,
    billing_cycle: cycle,
  };
}

function cycleFromBody(body: { billing_cycle?: unknown; billing_start_day?: unknown; billing_end_day?: unknown }): PersonalBillingCycle | null {
  if (body.billing_cycle && typeof body.billing_cycle === "object") {
    const raw = body.billing_cycle as Record<string, unknown>;
    const start = parseCycleDay(raw.start_day);
    const end = parseCycleDay(raw.end_day);
    if (!start || !end) return null;
    return { start_day: start, end_day: end };
  }

  const start = parseCycleDay(body.billing_start_day);
  if (!start) return null;
  const explicitEnd = body.billing_end_day !== undefined ? parseCycleDay(body.billing_end_day) : null;
  const end = explicitEnd || (typeof start === "number" && start > 1 ? start - 1 : "last");
  return { start_day: start, end_day: end };
}

export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  const meta = await getFreshUserMetadata(locals.accessToken, user);
  const cycle = normalizePersonalBillingCycle(meta.personal_billing_cycle, meta.billing_start_day);

  return json(cycleResponse(cycle));
};

export const PATCH: APIRoute = async ({ request, cookies, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { billing_cycle?: unknown; billing_start_day?: unknown; billing_end_day?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const cycle = cycleFromBody(body);
  if (!cycle) {
    return json({ error: "billing_cycle debe usar días 1-31 o 'last'" }, 400);
  }

  try {
    const refreshToken = cookies.get("sb-refresh-token")?.value;
    if (!refreshToken) {
      return json({ error: "Sesión incompleta. Vuelve a iniciar sesión." }, 401);
    }

    const client = createAuthClient(locals.accessToken);
    const { error: sessionError } = await client.auth.setSession({
      access_token: locals.accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) {
      return json({ error: sessionError.message }, 401);
    }

    const currentMeta = await getFreshUserMetadata(locals.accessToken, user);
    const nextMetadata = {
      ...currentMeta,
      personal_billing_cycle: cycle,
      billing_start_day: legacyStartDay(cycle),
    };

    const { data, error } = await client.auth.updateUser({
      data: nextMetadata,
    });

    if (error) {
      return json({ error: error.message }, 500);
    }

    const session = data.user ? (await client.auth.getSession()).data.session : null;
    if (session?.access_token && session?.refresh_token) {
      cookies.set("sb-access-token", session.access_token, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
      });
      cookies.set("sb-refresh-token", session.refresh_token, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return json({ ok: true, ...cycleResponse(cycle) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return json({ error: msg }, 500);
  }
};
