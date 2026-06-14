import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { CATEGORIES } from "../../../lib/personalExpenses.js";

const ALLOWED_CATEGORIES = CATEGORIES as readonly string[];
const MONTH_RE = /^\d{4}-\d{2}$/;

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

function validateInstallmentPayload(body: {
  merchant?: string;
  total_amount?: unknown;
  total_installments?: unknown;
  category?: string;
  start_month?: string;
  description?: string | null;
}) {
  const merchant = String(body.merchant || "").trim();
  if (!merchant) return { error: "merchant requerido" } as const;

  const totalAmount = toMoney(body.total_amount);
  if (totalAmount < 100) return { error: "total_amount debe ser ≥ 100" } as const;

  const totalInstallments = Math.round(Number(body.total_installments) || 0);
  if (totalInstallments < 2 || totalInstallments > 120) {
    return { error: "total_installments debe estar entre 2 y 120" } as const;
  }

  const category = String(body.category || "Otros").trim();
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return { error: `Categoría inválida: ${category}` } as const;
  }

  const startMonth = String(body.start_month || "").trim();
  if (!MONTH_RE.test(startMonth)) {
    return { error: "start_month debe ser YYYY-MM" } as const;
  }

  return {
    merchant,
    totalAmount,
    totalInstallments,
    monthlyAmount: Math.floor(totalAmount / totalInstallments),
    category,
    startMonth,
    description: String(body.description || merchant).trim().slice(0, 240),
  } as const;
}

function selectInstallment() {
  return "id, merchant, description, total_amount, total_installments, monthly_amount, start_month, category, created_at";
}

/**
 * POST /api/personal-expenses/installments — create a new installment plan
 * Body: { merchant, total_amount, total_installments, category, start_month, description?, source_expense_id? }
 *
 * When source_expense_id is provided, the endpoint verifies the source expense belongs to the
 * authenticated user, creates the installment plan, then deletes the original single expense.
 * RLS still protects both operations; if deletion fails after insert, the new plan is rolled back.
 *
 * PATCH /api/personal-expenses/installments — edit full installment plan
 * Body: { id, merchant?, total_amount?, total_installments?, category?, start_month?, description? }
 *
 * DELETE /api/personal-expenses/installments — delete an installment plan
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
    source_expense_id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const supabase = createAuthClient(locals.accessToken);
  let sourceExpense: any = null;

  if (body.source_expense_id) {
    const { data: existing, error: sourceError } = await supabase
      .from("personal_expenses")
      .select("id, merchant, description, amount, category, expense_date")
      .eq("id", body.source_expense_id)
      .eq("user_id", user.id)
      .single();

    if (sourceError || !existing) {
      return json({ error: "Gasto original no encontrado" }, 404);
    }

    sourceExpense = existing;
    body = {
      ...body,
      merchant: body.merchant ?? existing.merchant ?? existing.description ?? "Gasto personal",
      description: body.description ?? existing.description ?? existing.merchant ?? "Gasto personal",
      total_amount: body.total_amount ?? existing.amount,
      category: body.category ?? existing.category ?? "Otros",
      start_month: body.start_month ?? String(existing.expense_date || "").slice(0, 7),
    };
  }

  const validated = validateInstallmentPayload(body);
  if ("error" in validated) return json({ error: validated.error }, 400);

  const insertPayload = {
    user_id: user.id,
    merchant: validated.merchant,
    description: validated.description,
    total_amount: validated.totalAmount,
    total_installments: validated.totalInstallments,
    monthly_amount: validated.monthlyAmount,
    start_month: validated.startMonth,
    category: validated.category,
  };

  const { data, error } = await supabase
    .from("personal_installments")
    .insert(insertPayload)
    .select(selectInstallment())
    .single();

  if (error) {
    return json({ error: error.message }, 500);
  }

  if (sourceExpense) {
    const { error: delError } = await supabase
      .from("personal_expenses")
      .delete()
      .eq("id", sourceExpense.id)
      .eq("user_id", user.id);

    if (delError) {
      const insertedId = (data as unknown as { id: string }).id;
      await supabase
        .from("personal_installments")
        .delete()
        .eq("id", insertedId)
        .eq("user_id", user.id);
      return json({ error: delError.message }, 500);
    }
  }

  return json({ ok: true, installment: data, source_expense_deleted: Boolean(sourceExpense) }, 201);
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
    return json({ error: "Cuota no encontrada" }, 404);
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

  const { data: existing, error: findError } = await supabase
    .from("personal_installments")
    .select("id, merchant, description, total_amount, total_installments, monthly_amount, start_month, category")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .single();

  if (findError || !existing) {
    return json({ error: "Cuota no encontrada" }, 404);
  }

  const merged = {
    merchant: body.merchant ?? existing.merchant,
    description: body.description ?? existing.description,
    total_amount: body.total_amount ?? existing.total_amount,
    total_installments: body.total_installments ?? existing.total_installments,
    category: body.category ?? existing.category,
    start_month: body.start_month ?? existing.start_month,
  };

  const validated = validateInstallmentPayload(merged);
  if ("error" in validated) return json({ error: validated.error }, 400);

  const update = {
    merchant: validated.merchant,
    description: validated.description,
    total_amount: validated.totalAmount,
    total_installments: validated.totalInstallments,
    monthly_amount: validated.monthlyAmount,
    start_month: validated.startMonth,
    category: validated.category,
  };

  const { data: updated, error: updError } = await supabase
    .from("personal_installments")
    .update(update)
    .eq("id", body.id)
    .eq("user_id", user.id)
    .select(selectInstallment())
    .single();

  if (updError) return json({ error: updError.message }, 500);

  return json({ ok: true, installment: updated });
};
