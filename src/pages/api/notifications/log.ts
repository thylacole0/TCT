import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals }) => {
  const { user } = locals;
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  try {
    const body = await request.json();
    const { createServiceClient } = await import("../../../lib/supabase");
    const supabase = createServiceClient();

    const required = ["raw_text", "status"];
    const missing = required.filter((f) => !body[f]);
    if (missing.length > 0) {
      return new Response(JSON.stringify({ error: `Missing fields: ${missing.join(", ")}` }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const { data, error } = await supabase
      .from("notification_log")
      .insert({
        user_id: user.id,
        raw_text: body.raw_text,
        source: body.source || null,
        amount: body.amount || null,
        merchant: body.merchant || null,
        card_last4: body.card_last4 || null,
        fingerprint: body.fingerprint || null,
        status: body.status,
        error_reason: body.error_reason || null,
        telegram_chat_id: body.telegram_chat_id || null,
        telegram_message_id: body.telegram_message_id || null,
        expense_id: body.expense_id || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("notification_log insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
