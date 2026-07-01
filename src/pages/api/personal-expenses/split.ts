import type { APIRoute } from "astro";
import { createAuthClient, createServiceClient } from "../../../lib/supabase";

/**
 * POST /api/personal-expenses/split
 *
 * Body: { id: string }
 *
 * Splits a personal expense in half: reduces the owner's amount to 50%
 * and creates a copy (other 50%) on the partner's account via service_role.
 *
 * Returns the partner info and new amounts on success,
 * or { error: "no_partner" } if no other household user exists.
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

  // 1. Verify ownership and get current expense
  const { data: expense, error: findError } = await supabase
    .from("personal_expenses")
    .select("id, user_id, amount, merchant, description, category, expense_date, expense_time, card_last4, original_amount, is_split")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .single();

  if (findError || !expense) {
    return new Response(
      JSON.stringify({ error: "Expense not found or access denied" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const amount = Number(expense.amount);
  if (amount < 20) {
    return new Response(
      JSON.stringify({ error: "El monto mínimo para dividir es $20" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (expense.is_split || expense.original_amount) {
    return new Response(
      JSON.stringify({ error: "Este gasto ya fue dividido" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Find partner (any other household member, excluding admins)
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .neq("id", user.id)
    .eq("role", "member")
    .limit(1);

  if (profilesError) {
    return new Response(JSON.stringify({ error: profilesError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!profiles || profiles.length === 0) {
    return new Response(
      JSON.stringify({
        error: "no_partner",
        message: "No se encontró otro usuario en el sistema para dividir este gasto.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const partner = profiles[0];

  // 3. Calculate halves (rounding difference goes to partner)
  const half = Math.round(amount / 2);
  const otherHalf = amount - half;

  // 4. Update own expense to half
  const { error: updateError } = await supabase
    .from("personal_expenses")
    .update({
      amount: half,
      original_amount: amount,
      is_split: true,
    })
    .eq("id", body.id)
    .eq("user_id", user.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 5. Create partner's copy via service_role (bypasses RLS)
  const serviceClient = createServiceClient();
  const { data: partnerExpense, error: createError } = await serviceClient
    .from("personal_expenses")
    .insert({
      user_id: partner.id,
      amount: otherHalf,
      merchant: expense.merchant,
      description: expense.description,
      category: expense.category,
      expense_date: expense.expense_date,
      expense_time: expense.expense_time,
      card_last4: expense.card_last4 || null,
      source: "split",
      original_amount: amount,
      is_split: true,
      split_pair_id: body.id,
    })
    .select("id")
    .single();

  if (createError || !partnerExpense) {
    return new Response(JSON.stringify({ error: createError?.message || "Error al crear el gasto para tu pareja" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 6. Link own expense back to partner's copy
  await supabase
    .from("personal_expenses")
    .update({ split_pair_id: partnerExpense.id })
    .eq("id", body.id)
    .eq("user_id", user.id);

  return new Response(
    JSON.stringify({
      ok: true,
      partner: { id: partner.id, display_name: partner.display_name },
      own_amount: half,
      partner_amount: otherHalf,
      original_amount: amount,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
