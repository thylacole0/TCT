import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import {
  cleanupStaleSubscriptions,
  ensureVapidConfigured,
  getUserPushSubscriptions,
  sendPushPayload,
} from "../../../lib/push";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return json({ error: "Unauthorized" }, 401);
  }

  const vapid = ensureVapidConfigured();
  if (!vapid.ok) return json({ error: vapid.error }, vapid.status);

  const supabase = createAuthClient(locals.accessToken);
  const { subscriptions, error } = await getUserPushSubscriptions(supabase, user.id);
  if (error) return json({ error }, 500);

  if (subscriptions.length === 0) {
    return json({ sent: 0, failed: 0, cleaned: 0, reason: "no_subscriptions" });
  }

  const payload = JSON.stringify({
    title: "TCT activo",
    body: "Las notificaciones funcionan en este dispositivo",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    url: "/config",
    tag: `push-test-${user.id}-${Date.now()}`,
  });

  const result = await sendPushPayload(subscriptions, payload);
  const cleaned = await cleanupStaleSubscriptions(supabase, user.id, result.staleEndpoints);
  return json({ ok: true, sent: result.sent, failed: result.failed, cleaned });
};
