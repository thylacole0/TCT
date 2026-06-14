import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { supabase } from "./supabase";

export type PushSubscriptionRow = {
  user_id?: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
};

export type PersonalExpensePushInput = {
  id?: string | null;
  user_id: string;
  amount: number;
  merchant?: string | null;
  description?: string | null;
  category?: string | null;
  source?: string | null;
  expense_date?: string | null;
  expense_time?: string | null;
};

type PersonalExpensePushContextRow = PushSubscriptionRow & {
  expense_id: string;
  amount: number | string;
  merchant: string | null;
  description: string | null;
  category: string | null;
  source: string | null;
  expense_date: string | null;
  expense_time: string | null;
};

export type PushSendResult = {
  sent: number;
  failed: number;
  cleaned: number;
  staleEndpoints: string[];
};

export function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function requireCronSecret(authHeader: string | null): { ok: true; secret: string } | { ok: false; status: number; error: string } {
  const configuredSecret = import.meta.env.CRON_SECRET;
  if (!configuredSecret) {
    return { ok: false, status: 500, error: "CRON_SECRET no configurado" };
  }

  const providedSecret = getBearerToken(authHeader);
  if (!providedSecret || providedSecret !== configuredSecret) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true, secret: providedSecret };
}

export function ensureVapidConfigured(): { ok: true } | { ok: false; status: number; error: string } {
  const vapidPublic = import.meta.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = import.meta.env.VAPID_PRIVATE_KEY;

  if (!vapidPublic || !vapidPrivate) {
    return { ok: false, status: 500, error: "VAPID keys not configured" };
  }

  webpush.setVapidDetails("mailto:tct-app@example.com", vapidPublic, vapidPrivate);
  return { ok: true };
}

export async function getUserPushSubscriptions(
  client: SupabaseClient,
  userId: string
): Promise<{ subscriptions: PushSubscriptionRow[]; error?: string }> {
  const { data, error } = await client
    .from("push_subscriptions")
    .select("user_id,endpoint,keys_p256dh,keys_auth")
    .eq("user_id", userId);

  if (error) {
    return { subscriptions: [], error: error.message };
  }

  return { subscriptions: (data || []) as PushSubscriptionRow[] };
}

export async function getUserPushSubscriptionsWithSecret(
  userId: string,
  cronSecret: string
): Promise<{ subscriptions: PushSubscriptionRow[]; error?: string }> {
  const { data, error } = await supabase.rpc("get_push_subscriptions_for_user", {
    p_secret: cronSecret,
    p_user_id: userId,
  });

  if (error) {
    return { subscriptions: [], error: error.message };
  }

  return { subscriptions: (data || []) as PushSubscriptionRow[] };
}

export async function getPersonalExpensePushContext(
  expenseId: string,
  cronSecret: string
): Promise<{
  expense: PersonalExpensePushInput | null;
  subscriptions: PushSubscriptionRow[];
  error?: string;
}> {
  const { data, error } = await supabase.rpc("get_personal_expense_push_context", {
    p_secret: cronSecret,
    p_expense_id: expenseId,
  });

  if (error) {
    return { expense: null, subscriptions: [], error: error.message };
  }

  const rows = (data || []) as PersonalExpensePushContextRow[];
  const first = rows[0];
  if (!first) {
    return { expense: null, subscriptions: [] };
  }

  return {
    expense: {
      id: first.expense_id,
      user_id: String(first.user_id),
      amount: toNumber(first.amount),
      merchant: first.merchant,
      description: first.description,
      category: first.category,
      source: first.source,
      expense_date: first.expense_date,
      expense_time: first.expense_time,
    },
    subscriptions: rows.map((row) => ({
      user_id: String(row.user_id),
      endpoint: row.endpoint,
      keys_p256dh: row.keys_p256dh,
      keys_auth: row.keys_auth,
    })),
  };
}

export function buildPersonalExpensePushPayload(expense: PersonalExpensePushInput): string {
  const merchant = cleanLabel(expense.merchant || expense.description || "Gasto");
  const category = cleanLabel(expense.category || "Otros");
  const amount = formatCLP(expense.amount);
  const source = sourceLabel(expense.source);
  const tagId = expense.id || `${expense.user_id}-${expense.expense_date || "sin-fecha"}-${merchant}-${Math.round(expense.amount)}`;

  return JSON.stringify({
    title: "Gasto registrado",
    body: `${amount} · ${merchant} · ${category}${source ? ` · ${source}` : ""}`,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    url: "/finanzas-personales",
    tag: `personal-expense-${tagId}`,
  });
}

export async function sendPushPayload(
  subscriptions: PushSubscriptionRow[],
  payload: string
): Promise<PushSendResult> {
  const vapid = ensureVapidConfigured();
  if (!vapid.ok) {
    return { sent: 0, failed: subscriptions.length, cleaned: 0, staleEndpoints: [] };
  }

  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        payload,
        { TTL: 3600 }
      );
      sent++;
    } catch (err: any) {
      failed++;
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        staleEndpoints.push(sub.endpoint);
      }
    }
  }

  return { sent, failed, cleaned: 0, staleEndpoints };
}

export async function cleanupStaleSubscriptions(
  client: SupabaseClient,
  userId: string,
  endpoints: string[]
): Promise<number> {
  if (endpoints.length === 0) return 0;

  const { error } = await client
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .in("endpoint", endpoints);

  return error ? 0 : endpoints.length;
}

export async function cleanupStaleSubscriptionsWithSecret(
  cronSecret: string,
  endpoints: string[]
): Promise<number> {
  if (endpoints.length === 0) return 0;

  const { data, error } = await supabase.rpc("delete_stale_push_subscriptions", {
    p_secret: cronSecret,
    p_endpoints: endpoints,
  });

  if (error) return 0;
  return typeof data === "number" ? data : endpoints.length;
}

export async function sendPersonalExpensePushForAuthenticatedUser(
  client: SupabaseClient,
  expense: PersonalExpensePushInput
): Promise<PushSendResult & { skippedReason?: string }> {
  if ((expense.source || "manual") === "manual") {
    return { sent: 0, failed: 0, cleaned: 0, staleEndpoints: [], skippedReason: "manual_expense" };
  }

  const { subscriptions, error } = await getUserPushSubscriptions(client, expense.user_id);
  if (error) {
    return { sent: 0, failed: 0, cleaned: 0, staleEndpoints: [], skippedReason: error };
  }

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, cleaned: 0, staleEndpoints: [], skippedReason: "no_subscriptions" };
  }

  const result = await sendPushPayload(subscriptions, buildPersonalExpensePushPayload(expense));
  const cleaned = await cleanupStaleSubscriptions(client, expense.user_id, result.staleEndpoints);
  return { ...result, cleaned };
}

function cleanLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 80) || "Sin detalle";
}

function formatCLP(value: number): string {
  return `$${Math.round(value || 0).toLocaleString("es-CL")}`;
}

function sourceLabel(source?: string | null): string {
  if (!source || source === "manual" || source === "unknown") return "";
  if (source === "banco_falabella") return "Falabella";
  if (source === "google_pay") return "Google Pay";
  if (source === "telegram") return "Telegram";
  return cleanLabel(source.replace(/_/g, " "));
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}
