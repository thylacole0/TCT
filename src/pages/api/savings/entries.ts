import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────

interface SavingsEntry {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  entry_date: string;
  notes: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  return 0;
}

const MONTH_RE = /^\d{4}-\d{2}$/;

// ── GET /api/savings/entries?goal_id=UUID&month=YYYY-MM ───────────────────

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const goalId = url.searchParams.get("goal_id");
  const month = url.searchParams.get("month");

  const supabase = createAuthClient(locals.accessToken);

  let query = supabase
    .from("savings_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (goalId) {
    query = query.eq("goal_id", goalId);
  }

  if (month && MONTH_RE.test(month)) {
    const [year, mon] = month.split("-");
    // Use first and last day of the month
    const firstDay = `${year}-${mon}-01`;
    const lastDay = new Date(Number(year), Number(mon), 0).toISOString().slice(0, 10); // last day of month
    query = query.gte("entry_date", firstDay).lte("entry_date", lastDay);
  }

  const { data, error } = await query;

  if (error) {
    return json({ error: error.message }, 500);
  }

  const entries = (data as SavingsEntry[]) || [];

  // Calculate summary
  const totalDeposits = entries
    .filter((e) => Number(e.amount) > 0)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalWithdrawals = entries
    .filter((e) => Number(e.amount) < 0)
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);
  const netChange = totalDeposits - totalWithdrawals;

  return json({
    entries,
    summary: {
      total_deposits: totalDeposits,
      total_withdrawals: totalWithdrawals,
      net_change: netChange,
      count: entries.length,
    },
  });
};

// ── POST /api/savings/entries ──────────────────────────────────────────────
// Body: { goal_id, amount, entry_date?, notes? }
// Positive amount = deposit, negative = withdrawal
// After inserting, auto-updates the parent goal's current_amount by summing all entries.

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: {
    goal_id?: string;
    amount?: unknown;
    entry_date?: string;
    notes?: string;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Validate
  const goalId = (body.goal_id || "").trim();
  if (!goalId) return json({ error: "goal_id es requerido" }, 400);

  const amount = toMoney(body.amount);
  if (amount === 0) return json({ error: "amount no puede ser 0" }, 400);

  const entryDate = body.entry_date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return json({ error: "entry_date debe ser YYYY-MM-DD" }, 400);
  }

  const notes = (body.notes || "").trim() || null;

  const supabase = createAuthClient(locals.accessToken);

  // 1. Verify goal exists and belongs to user
  const { data: goal, error: goalError } = await supabase
    .from("savings_goals")
    .select("id, user_id, current_amount")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .single();

  if (goalError || !goal) {
    return json({ error: "Savings goal not found or access denied" }, 404);
  }

  // 2. Insert the entry
  const { data: entry, error: insertError } = await supabase
    .from("savings_entries")
    .insert({
      goal_id: goalId,
      user_id: user.id,
      amount,
      entry_date: entryDate,
      notes,
    })
    .select()
    .single();

  if (insertError) {
    return json({ error: insertError.message }, 500);
  }

  // 3. Recalculate the goal's current_amount by summing all entries
  const { data: sumResult, error: sumError } = await supabase
    .from("savings_entries")
    .select("amount")
    .eq("goal_id", goalId)
    .eq("user_id", user.id);

  if (sumError) {
    return json({ error: sumError.message }, 500);
  }

  const newCurrentAmount = (sumResult as { amount: number }[]).reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );

  // 4. Update the goal's current_amount
  const { error: updateError } = await supabase
    .from("savings_goals")
    .update({ current_amount: newCurrentAmount })
    .eq("id", goalId)
    .eq("user_id", user.id);

  if (updateError) {
    // Entry was created but goal update failed — still return the entry
    // The current_amount will be stale until next recalculation
    return json({
      ok: true,
      entry,
      goal_current_amount: newCurrentAmount,
      warning: "Goal current_amount update failed: " + updateError.message,
    }, 201);
  }

  return json({
    ok: true,
    entry,
    goal_current_amount: newCurrentAmount,
  }, 201);
};

// ── Recalculate a goal's current_amount from the sum of its entries ──────────

async function recalcGoalTotal(
  supabase: ReturnType<typeof createAuthClient>,
  goalId: string,
  userId: string
): Promise<{ total: number; error?: string }> {
  const { data, error } = await supabase
    .from("savings_entries")
    .select("amount")
    .eq("goal_id", goalId)
    .eq("user_id", userId);

  if (error) return { total: 0, error: error.message };

  const total = (data as { amount: number }[]).reduce((sum, row) => sum + Number(row.amount), 0);

  const { error: updateError } = await supabase
    .from("savings_goals")
    .update({ current_amount: total })
    .eq("id", goalId)
    .eq("user_id", userId);

  return { total, error: updateError?.message };
}

// ── PATCH /api/savings/entries ── edit an existing aporte (amount/date/notes) ─

export const PATCH: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { id?: string; amount?: unknown; entry_date?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const id = (body.id || "").trim();
  if (!id) return json({ error: "id es requerido" }, 400);

  const supabase = createAuthClient(locals.accessToken);

  // Verify the entry exists and belongs to the user (and learn its goal_id).
  const { data: existing, error: findError } = await supabase
    .from("savings_entries")
    .select("id, goal_id, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (findError || !existing) {
    return json({ error: "Aporte no encontrado o sin acceso" }, 404);
  }

  const updates: { amount?: number; entry_date?: string; notes?: string | null } = {};

  if (body.amount !== undefined) {
    const amount = toMoney(body.amount);
    if (amount === 0) return json({ error: "amount no puede ser 0" }, 400);
    updates.amount = amount;
  }
  if (body.entry_date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.entry_date)) {
      return json({ error: "entry_date debe ser YYYY-MM-DD" }, 400);
    }
    updates.entry_date = body.entry_date;
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return json({ error: "Nada que actualizar" }, 400);
  }

  const { data: entry, error: updateError } = await supabase
    .from("savings_entries")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (updateError) return json({ error: updateError.message }, 500);

  const { total, error: recalcError } = await recalcGoalTotal(supabase, (existing as any).goal_id, user.id);

  return json({ ok: true, entry, goal_current_amount: total, warning: recalcError }, 200);
};

// ── DELETE /api/savings/entries ── remove an aporte ──────────────────────────

export const DELETE: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const id = (body.id || "").trim();
  if (!id) return json({ error: "id es requerido" }, 400);

  const supabase = createAuthClient(locals.accessToken);

  const { data: existing, error: findError } = await supabase
    .from("savings_entries")
    .select("id, goal_id, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (findError || !existing) {
    return json({ error: "Aporte no encontrado o sin acceso" }, 404);
  }

  const { error: deleteError } = await supabase
    .from("savings_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) return json({ error: deleteError.message }, 500);

  const { total, error: recalcError } = await recalcGoalTotal(supabase, (existing as any).goal_id, user.id);

  return json({ ok: true, goal_current_amount: total, warning: recalcError }, 200);
};
