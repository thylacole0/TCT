import type { APIRoute } from "astro";
import { createAuthClient } from "../../../../lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────

interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number | null;
  start_date: string;
  target_date: string | null;
  color: string;
  icon: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // computed
  progress_pct?: number;
  remaining?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  return 0;
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

function computeProgress(goal: SavingsGoal): SavingsGoal {
  const target = Number(goal.target_amount) || 0;
  const current = Number(goal.current_amount) || 0;
  const progressPct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return {
    ...goal,
    progress_pct: progressPct,
    remaining: Math.max(0, target - current),
  };
}

// ── PATCH /api/savings/goals/[id] ──────────────────────────────────────────
// Body (all optional): { name?, target_amount?, monthly_contribution?,
//   start_date?, target_date?, color?, icon?, is_active?, notes? }

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  const goalId = params.id;
  if (!goalId) {
    return json({ error: "Missing goal id" }, 400);
  }

  let body: {
    name?: string;
    target_amount?: unknown;
    monthly_contribution?: unknown;
    start_date?: string;
    target_date?: string | null;
    color?: string;
    icon?: string;
    is_active?: boolean;
    notes?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const supabase = createAuthClient(locals.accessToken);

  // Verify ownership
  const { data: existing, error: findError } = await supabase
    .from("savings_goals")
    .select("id, user_id")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .single();

  if (findError || !existing) {
    return json({ error: "Goal not found or access denied" }, 404);
  }

  // Build update payload (only provided fields)
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = (body.name || "").trim();
    if (!name) return json({ error: "name no puede estar vacío" }, 400);
    updates.name = name;
  }

  if (body.target_amount !== undefined) {
    const targetAmount = toMoney(body.target_amount);
    if (targetAmount <= 0) return json({ error: "target_amount debe ser > 0" }, 400);
    updates.target_amount = targetAmount;
  }

  if (body.monthly_contribution !== undefined) {
    updates.monthly_contribution = body.monthly_contribution === null ? null : toMoney(body.monthly_contribution);
  }

  if (body.start_date !== undefined) {
    if (!isValidDate(body.start_date)) return json({ error: "start_date debe ser YYYY-MM-DD" }, 400);
    updates.start_date = body.start_date;
  }

  if (body.target_date !== undefined) {
    if (body.target_date === null) {
      updates.target_date = null;
    } else if (isValidDate(body.target_date)) {
      updates.target_date = body.target_date;
    } else {
      return json({ error: "target_date debe ser YYYY-MM-DD o null" }, 400);
    }
  }

  if (body.color !== undefined) {
    updates.color = (body.color || "#10B981").trim();
  }

  if (body.icon !== undefined) {
    updates.icon = (body.icon || "piggy-bank").trim();
  }

  if (body.is_active !== undefined) {
    updates.is_active = Boolean(body.is_active);
  }

  if (body.notes !== undefined) {
    updates.notes = body.notes === null ? null : (body.notes || "").trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return json({ error: "No fields to update" }, 400);
  }

  const { data, error } = await supabase
    .from("savings_goals")
    .update(updates)
    .eq("id", goalId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ ok: true, goal: computeProgress(data as SavingsGoal) });
};

// ── DELETE /api/savings/goals/[id] ─────────────────────────────────────────

export const DELETE: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  const goalId = params.id;
  if (!goalId) {
    return json({ error: "Missing goal id" }, 400);
  }

  const supabase = createAuthClient(locals.accessToken);

  // Verify ownership before deleting
  const { data: existing, error: findError } = await supabase
    .from("savings_goals")
    .select("id")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .single();

  if (findError || !existing) {
    return json({ error: "Goal not found or access denied" }, 404);
  }

  const { error: deleteError } = await supabase
    .from("savings_goals")
    .delete()
    .eq("id", goalId)
    .eq("user_id", user.id);

  if (deleteError) {
    return json({ error: deleteError.message }, 500);
  }

  return json({ ok: true, id: goalId });
};
