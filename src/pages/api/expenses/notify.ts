import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

/**
 * POST /api/expenses/notify
 *
 * Receives a raw notification text from the mobile app (Flutter / iOS Shortcuts).
 * Stores it in pending_expenses for later classification by Hermes Agent.
 *
 * Body: { raw_text: string, source?: string }
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { raw_text?: string; source?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!body.raw_text || typeof body.raw_text !== "string" || body.raw_text.trim().length === 0) {
    return new Response("raw_text is required and must be a non-empty string", { status: 400 });
  }

  const supabase = createAuthClient(locals.accessToken);

  const { data, error } = await supabase
    .from("pending_expenses")
    .insert({
      user_id: user.id,
      raw_text: body.raw_text.trim(),
      source: body.source || "notification",
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, id: data.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
