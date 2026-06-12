import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

/**
 * POST /api/personal-expenses/delete
 *
 * Body: { id: string }
 * Deletes a personal expense owned by the authenticated user.
 * Only the owner (user_id = auth.uid()) can delete.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.id) {
    return new Response(
      JSON.stringify({ error: "Missing required field: id" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createAuthClient(locals.accessToken);

  // Verify ownership before deleting
  const { data: existing, error: findError } = await supabase
    .from("personal_expenses")
    .select("id")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .single();

  if (findError || !existing) {
    return new Response(
      JSON.stringify({ error: "Expense not found or access denied" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const { error: deleteError } = await supabase
    .from("personal_expenses")
    .delete()
    .eq("id", body.id)
    .eq("user_id", user.id);

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, id: body.id }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
