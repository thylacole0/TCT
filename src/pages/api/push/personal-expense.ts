import type { APIRoute } from "astro";
import {
  buildPersonalExpensePushPayload,
  cleanupStaleSubscriptionsWithSecret,
  ensureVapidConfigured,
  getPersonalExpensePushContext,
  getUserPushSubscriptionsWithSecret,
  requireCronSecret,
  sendPushPayload,
  type PersonalExpensePushInput,
} from "../../../lib/push";

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

function normalizeExpense(value: unknown): PersonalExpensePushInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const userId = String(raw.user_id || "").trim();
  const amount = toMoney(raw.amount);
  if (!userId || amount <= 0) return null;

  return {
    id: typeof raw.id === "string" ? raw.id : typeof raw.expense_id === "string" ? raw.expense_id : null,
    user_id: userId,
    amount,
    merchant: typeof raw.merchant === "string" ? raw.merchant : null,
    description: typeof raw.description === "string" ? raw.description : null,
    category: typeof raw.category === "string" ? raw.category : null,
    source: typeof raw.source === "string" ? raw.source : "unknown",
    expense_date: typeof raw.expense_date === "string" ? raw.expense_date : null,
    expense_time: typeof raw.expense_time === "string" ? raw.expense_time : null,
  };
}

export const POST: APIRoute = async ({ request }) => {
  const auth = requireCronSecret(request.headers.get("authorization"));
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const vapid = ensureVapidConfigured();
  if (!vapid.ok) return json({ error: vapid.error }, vapid.status);

  let body: { expense_id?: string; user_id?: string; expense?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const expenseId = typeof body.expense_id === "string" ? body.expense_id.trim() : "";
  let expense: PersonalExpensePushInput | null = null;
  let subscriptions = [] as Awaited<ReturnType<typeof getUserPushSubscriptionsWithSecret>>["subscriptions"];
  let contextWarning: string | undefined;

  if (expenseId) {
    const context = await getPersonalExpensePushContext(expenseId, auth.secret);
    if (context.error) {
      contextWarning = context.error;
    } else {
      expense = context.expense;
      subscriptions = context.subscriptions;
    }
  }

  if (!expense) {
    expense = normalizeExpense(body.expense || body);
  }

  if (!expense) {
    return json({ error: "Debes enviar expense_id o expense/user_id+amount" }, 400);
  }

  if ((expense.source || "manual") === "manual") {
    return json({ sent: 0, failed: 0, cleaned: 0, skipped: true, reason: "manual_expense" });
  }

  if (subscriptions.length === 0) {
    const lookup = await getUserPushSubscriptionsWithSecret(expense.user_id, auth.secret);
    if (lookup.error) {
      return json({ error: lookup.error, contextWarning }, 500);
    }
    subscriptions = lookup.subscriptions;
  }

  if (subscriptions.length === 0) {
    return json({ sent: 0, failed: 0, cleaned: 0, reason: "no_subscriptions", contextWarning });
  }

  const result = await sendPushPayload(subscriptions, buildPersonalExpensePushPayload(expense));
  const cleaned = await cleanupStaleSubscriptionsWithSecret(auth.secret, result.staleEndpoints);

  return json({
    ok: true,
    sent: result.sent,
    failed: result.failed,
    cleaned,
    expense_id: expense.id || expenseId || null,
    contextWarning,
  });
};
