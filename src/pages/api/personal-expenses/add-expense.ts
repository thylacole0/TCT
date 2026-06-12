import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { CATEGORIES } from "../../../lib/personalExpenses.js";

const ALLOWED_CATEGORIES = CATEGORIES as readonly string[];
const ALLOWED_SOURCES = ["banco_falabella", "google_pay", "telegram", "manual", "unknown"];

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
 * POST /api/personal-expenses/add
 * Body: { merchant, amount, category, expense_date?, expense_time?, description?, card_last4? }
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: {
    merchant?: string;
    amount?: unknown;
    category?: string;
    expense_date?: string;
    expense_time?: string;
    description?: string;
    card_last4?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Validate
  const merchant = (body.merchant || "").trim();
  if (!merchant) return json({ error: "merchant requerido" }, 400);

  const amount = toMoney(body.amount);
  if (amount < 10) return json({ error: "amount debe ser ≥ 10" }, 400);

  const category = (body.category || "Otros").trim();
  if (!(ALLOWED_CATEGORIES as readonly string[]).includes(category)) {
    return json({ error: `Categoría inválida: ${category}` }, 400);
  }

  const expenseDate = body.expense_date || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
    return json({ error: "expense_date debe ser YYYY-MM-DD" }, 400);
  }

  const expenseTime = body.expense_time || new Date().toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Santiago" });

  const description = (body.description || merchant).trim().slice(0, 240);
  const cardLast4 = (body.card_last4 || "").trim().slice(0, 4);
  const source = "manual";

  const supabase = createAuthClient(locals.accessToken);

  const fingerprint = `manual-${user.id}-${expenseDate}-${amount}-${merchant.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  const { data, error } = await supabase
    .from("personal_expenses")
    .insert({
      user_id: user.id,
      merchant,
      description,
      amount,
      category,
      expense_date: expenseDate,
      expense_time: expenseTime,
      source,
      card_last4: cardLast4 || null,
      fingerprint,
    })
    .select("id, merchant, amount, category, expense_date, expense_time, created_at")
    .single();

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ ok: true, message: "Gasto agregado", expense: data }, 201);
};
