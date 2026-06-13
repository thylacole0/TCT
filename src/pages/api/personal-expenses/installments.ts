import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { CATEGORIES } from "../../../lib/personalExpenses.js";

const ALLOWED_CATEGORIES = CATEGORIES as readonly string[];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  }
  return 0;
}

/**
 * POST /api/personal-expenses/installments — create a new installment plan
 * Body: { merchant, total_amount (CLP), total_installments, category, start_month (YYYY-MM), description? }
 *
 * DELETE /api/personal-expenses/installments — delete an installment
 * Body: { id }
 */

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: {
    merchant?: string;
    total_amount?: unknown;
    total_installments?: unknown;
    category?: string;
    start_month?: string;
    description?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Validate
  const merchant = (body.merchant || "").trim();
  if (!merchant) return json({ error: "merchant requerido" }, 400);

  const totalAmount = toMoney(body.total_amount);
  if (totalAmount < 100) return json({ error: "total_amount debe ser ≥ 100" }, 400);

  const totalInstallments = Math.round(Number(body.total_installments) || 0);
  if (totalInstallments < 2 || totalInstallments > 120) {
    return json({ error: "total_installments debe estar entre 2 y 120" }, 400);
  }

  const category = (body.category || "Otros").trim();
  if (!(ALLOWED_CATEGORIES as readonly string[]).includes(category)) {
    return json({ error: `Categoría inválida: ${category}` }, 400);
  }

  const startMonth = (body.start_month || "").trim();
  if (!/^\d{4}-\d{2}$/.test(startMonth)) {
    return json({ error: "start_month debe ser YYYY-MM" }, 400);
  }

  const monthlyAmount = Math.floor(totalAmount / totalInstallments);
  const description = (body.description || merchant).trim().slice(0, 240);

  const supabase = createAuthClient(locals.accessToken);

  const { data, error } = await supabase
    .from("personal_installments")
    .insert({
      user_id: user.id,
      merchant,
      description,
      total_amount: totalAmount,
      total_installments: totalInstallments,
      monthly_amount: monthlyAmount,
      start_month: startMonth,
      category,
    })
    .select("id, merchant, description, total_amount, total_installments, monthly_amount, start_month, category, created_at")
    .single();

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ ok: true, installment: data }, 201);
};

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

  if (!body.id) return json({ error: "id requerido" }, 400);

  const supabase = createAuthClient(locals.accessToken);

  const { data: existing, error: findError } = await supabase
    .from("personal_installments")
    .select("id")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .single();

  if (findError || !existing) {
    return json({ error: "Instalment not found" }, 404);
  }

  const { error: delError } = await supabase
    .from("personal_installments")
    .delete()
    .eq("id", body.id)
    .eq("user_id", user.id);

  if (delError) return json({ error: delError.message }, 500);

  return json({ ok: true, id: body.id });
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: {
    id?: string;
    merchant?: string;
    total_amount?: unknown;
    total_installments?: unknown;
    category?: string;
    start_month?: string;
    description?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!body.id) return json({ error: "id requerido" }, 400);

  const supabase = createAuthClient(locals.accessToken);

  // Verify ownership
  const { data: existing, error: findError } = await supabase
    .from("personal_installments")
    .select("id, total_amount, total_installments")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .single();

  if (findError || !existing) {
    return json({ error: "Instalment not found or access denied" }, 404);
  }

  const update: Record<string, unknown> = {};

  if (body.merchant !== undefined) {
    const m = String(body.merchant).trim();
    if (!m) return json({ error: "merchant no puede estar vacío" }, 400);
    update.merchant = m;
  }
  if (body.total_amount !== undefined) {
    const amt = toMoney(body.total_amount);
    if (amt < 100) return json({ error: "total_amount debe ser ≥ 100" }, 400);
    update.total_amount = amt;
  }
  if (body.total_installments !== undefined) {
    const n = Math.round(Number(body.total_installments) || 0);
    if (n < 2 || n > 120) return json({ error: "total_installments debe estar entre 2 y 120" }, 400);
    update.total_installments = n;
  }
  if (body.category !== undefined) {
    const c = String(body.category).trim();
    if (!(ALLOWED_CATEGORIES as readonly string[]).includes(c)) {
      return json({ error: `Categoría inválida: ${c}` }, 400);
    }
    update.category = c;
  }
  if (body.start_month !== undefined) {
    const sm = String(body.start_month).trim();
    if (!/^\d{4}-\d{2}$/.test(sm)) return json({ error: "start_month debe ser YYYY-MM" }, 400);
    update.start_month = sm;
  }
  if (body.description !== undefined) {
    update.description = String(body.description).trim().slice(0, 240);
  }

  // Recalculate monthly_amount if amount or installments changed
  const finalAmount = (update.total_amount as number) ?? existing.total_amount;
  const finalInstallments = (update.total_installments as number) ?? existing.total_installments;
  update.monthly_amount = Math.floor(Number(finalAmount) / Number(finalInstallments));

  const { data: updated, error: updError } = await supabase
    .from("personal_installments")
    .update(update)
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select("id, merchant, description, total_amount, total_installments, monthly_amount, start_month, category, created_at")
    .single();

  if (updError) return json({ error: updError.message }, 500);

  return json({ ok: true, installment: updated });
};
