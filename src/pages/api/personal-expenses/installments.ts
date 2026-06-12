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
