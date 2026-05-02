import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

/** POST: save push subscription for the current user
 *  DELETE: remove push subscription
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const { user, accessToken } = locals;
  if (!user || !accessToken) return new Response("Unauthorized", { status: 401 });

  const supabase = createAuthClient(accessToken);
  const { subscription } = await request.json();

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return new Response("Invalid subscription", { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      keys_p256dh: subscription.keys.p256dh,
      keys_auth: subscription.keys.auth,
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const { user, accessToken } = locals;
  if (!user || !accessToken) return new Response("Unauthorized", { status: 401 });

  const supabase = createAuthClient(accessToken);
  const { endpoint } = await request.json();

  if (!endpoint) return new Response("Missing endpoint", { status: 400 });

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
