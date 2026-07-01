import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

/**
 * GET /api/profiles/list
 *
 * Returns all profiles of the household except the authenticated user.
 * Used to find a partner for expense splitting.
 */
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createAuthClient(locals.accessToken);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role")
    .neq("id", user.id)
    .eq("role", "member")
    .order("display_name", { ascending: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data || []), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
