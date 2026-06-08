import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { CATEGORIES } from "../../../lib/personalExpenses.js";

const MONTH_RE = /^\d{4}-\d{2}$/;

type CategoryBudgetMap = Record<string, number>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function defaultBudgets(): CategoryBudgetMap {
  return Object.fromEntries(CATEGORIES.map((category: string) => [category, 0]));
}

function monthStartFromParam(month: string | null): string {
  if (month && MONTH_RE.test(month)) return `${month}-01`;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function isMissingTableError(error: any): boolean {
  const msg = String(error?.message || "").toLowerCase();
  return error?.code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
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

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const monthStart = monthStartFromParam(url.searchParams.get("month"));
  const supabase = createAuthClient(locals.accessToken);

  const { data: settings, error: settingsError } = await supabase
    .from("personal_monthly_settings")
    .select("monthly_income")
    .eq("user_id", user.id)
    .eq("month_start", monthStart)
    .maybeSingle();

  if (settingsError) {
    if (isMissingTableError(settingsError)) {
      return json({
        month_start: monthStart,
        monthly_income: 0,
        category_budgets: defaultBudgets(),
        storage_available: false,
        warning: "missing_personal_budget_tables",
      });
    }
    return json({ error: settingsError.message }, 500);
  }

  const { data: budgetRows, error: budgetsError } = await supabase
    .from("personal_category_budgets")
    .select("category,budget_amount")
    .eq("user_id", user.id)
    .eq("month_start", monthStart);

  if (budgetsError) {
    if (isMissingTableError(budgetsError)) {
      return json({
        month_start: monthStart,
        monthly_income: toMoney(settings?.monthly_income),
        category_budgets: defaultBudgets(),
        storage_available: false,
        warning: "missing_personal_budget_tables",
      });
    }
    return json({ error: budgetsError.message }, 500);
  }

  const categoryBudgets = defaultBudgets();
  for (const row of budgetRows || []) {
    if (CATEGORIES.includes(row.category)) {
      categoryBudgets[row.category] = toMoney(row.budget_amount);
    }
  }

  return json({
    month_start: monthStart,
    monthly_income: toMoney(settings?.monthly_income),
    category_budgets: categoryBudgets,
    storage_available: true,
  });
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: {
    month?: string;
    monthly_income?: unknown;
    category_budgets?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const monthStart = monthStartFromParam(body.month ?? null);
  const monthlyIncome = toMoney(body.monthly_income);
  const incomingBudgets = body.category_budgets || {};
  const categoryBudgets = defaultBudgets();

  for (const [category, value] of Object.entries(incomingBudgets)) {
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      return json({ error: `Categoría inválida: ${category}` }, 400);
    }
    categoryBudgets[category] = toMoney(value);
  }

  const supabase = createAuthClient(locals.accessToken);

  const { error: settingsError } = await supabase
    .from("personal_monthly_settings")
    .upsert(
      {
        user_id: user.id,
        month_start: monthStart,
        monthly_income: monthlyIncome,
      },
      { onConflict: "user_id,month_start" }
    );

  if (settingsError) {
    if (isMissingTableError(settingsError)) {
      return json({ error: "Falta aplicar la migración de presupuestos personales en Supabase." }, 503);
    }
    return json({ error: settingsError.message }, 500);
  }

  const budgetRows = CATEGORIES.map((category: string) => ({
    user_id: user.id,
    month_start: monthStart,
    category,
    budget_amount: categoryBudgets[category],
  }));

  const { error: budgetsError } = await supabase
    .from("personal_category_budgets")
    .upsert(budgetRows, { onConflict: "user_id,month_start,category" });

  if (budgetsError) {
    if (isMissingTableError(budgetsError)) {
      return json({ error: "Falta aplicar la migración de presupuestos personales en Supabase." }, 503);
    }
    return json({ error: budgetsError.message }, 500);
  }

  return json({
    ok: true,
    month_start: monthStart,
    monthly_income: monthlyIncome,
    category_budgets: categoryBudgets,
    storage_available: true,
  });
};
