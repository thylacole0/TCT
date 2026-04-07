import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (locals.userRole === 'admin') {
    return new Response("Admin is read-only", { status: 403 });
  }

  const supabase = createAuthClient(locals.accessToken);

  const formData = await request.formData();
  const choreId = formData.get("chore_id")?.toString();

  if (!choreId) {
    return new Response("chore_id required", { status: 400 });
  }

  // Get chore points
  const { data: chore, error: choreError } = await supabase
    .from("chores")
    .select("points")
    .eq("id", choreId)
    .single();

  if (choreError || !chore) {
    return new Response("Chore not found", { status: 404 });
  }

  const { error } = await supabase.from("chore_logs").insert({
    chore_id: choreId,
    user_id: user.id,
    points_earned: chore.points,
  });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, points: chore.points }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
