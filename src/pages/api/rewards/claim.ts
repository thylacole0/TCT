import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAuthClient(locals.accessToken);

  const formData = await request.formData();
  const rewardId = formData.get("reward_id")?.toString();

  if (!rewardId) {
    return new Response("reward_id required", { status: 400 });
  }

  // Get current month
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { error } = await supabase.from("reward_claims").insert({
    reward_id: rewardId,
    user_id: user.id,
    month,
  });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
