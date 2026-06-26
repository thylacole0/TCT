import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

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
  progress_pct: number;
  remaining: number;
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

/** Validate YYYY-MM-DD date string */
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

// ── GET /api/savings/goals ─────────────────────────────────────────────────
// Query params: ?include_inactive=true  (default: false — only active goals)

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("include_inactive") === "true";

  const supabase = createAuthClient(locals.accessToken);

  let query = supabase
    .from("savings_goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    return json({ error: error.message }, 500);
  }

  const goals = ((data as SavingsGoal[]) || []).map(computeProgress);

  return json({ goals });
};

// ── POST /api/savings/goals ────────────────────────────────────────────────
// Body: { name, target_amount, monthly_contribution?, start_date?, target_date?, color?, icon?, notes? }

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: {
    name?: string;
    target_amount?: unknown;
    monthly_contribution?: unknown;
    start_date?: string;
    target_date?: string;
    color?: string;
    icon?: string;
    notes?: string;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Validate
  const name = (body.name || "").trim();
  if (!name) return json({ error: "name es requerido" }, 400);

  const targetAmount = toMoney(body.target_amount);
  if (targetAmount <= 0) return json({ error: "target_amount debe ser > 0" }, 400);

  const monthlyContribution = body.monthly_contribution !== undefined ? toMoney(body.monthly_contribution) : null;

  const startDate = body.start_date || new Date().toISOString().slice(0, 10);
  if (!isValidDate(startDate)) return json({ error: "start_date debe ser YYYY-MM-DD" }, 400);

  const targetDate = body.target_date || null;
  if (targetDate && !isValidDate(targetDate)) return json({ error: "target_date debe ser YYYY-MM-DD" }, 400);

  const color = (body.color || "#10B981").trim();
  const icon = (body.icon || "piggy-bank").trim();
  const notes = (body.notes || "").trim() || null;

  const supabase = createAuthClient(locals.accessToken);

  const { data, error } = await supabase
    .from("savings_goals")
    .insert({
      user_id: user.id,
      name,
      target_amount: targetAmount,
      current_amount: 0,
      monthly_contribution: monthlyContribution,
      start_date: startDate,
      target_date: targetDate,
      color,
      icon,
      notes,
    })
    .select()
    .single();

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ ok: true, goal: computeProgress(data as SavingsGoal) }, 201);
};
