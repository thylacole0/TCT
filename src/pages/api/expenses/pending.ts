import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

/**
 * GET /api/expenses/pending
 *
 * Returns all pending_expenses with status='pending' for the authenticated user.
 * Useful for Hermes Agent to poll for new notifications to classify.
 */
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAuthClient(locals.accessToken);

  const { data, error } = await supabase
    .from("pending_expenses")
    .select("id, raw_text, source, created_at")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ pending: data || [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
