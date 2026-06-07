import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

const ALLOWED_CATEGORIES = [
  "Delivery",
  "Supermercado",
  "Transporte",
  "Gustos personales",
  "Gastos del hogar",
  "Suscripciones",
  "Otros",
];

/**
 * PATCH /api/personal-expenses/reclassify
 *
 * Body: { id: string, category: string }
 * Reclassifies a personal expense to the given category.
 * Only the owner (user_id = auth.uid()) can reclassify.
 */
export const PATCH: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { id?: string; category?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.id || !body.category) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: id, category" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const newCategory = body.category;
  if (!ALLOWED_CATEGORIES.includes(newCategory)) {
    return new Response(
      JSON.stringify({
        error: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(", ")}`,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createAuthClient(locals.accessToken);

  // Verify ownership before updating
  const { data: existing, error: findError } = await supabase
    .from("personal_expenses")
    .select("id, category")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .single();

  if (findError || !existing) {
    return new Response(JSON.stringify({ error: "Expense not found or access denied" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (existing.category === newCategory) {
    return new Response(
      JSON.stringify({ ok: true, message: "Sin cambios", id: body.id, category: newCategory }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const { error: updateError } = await supabase
    .from("personal_expenses")
    .update({ category: newCategory })
    .eq("id", body.id)
    .eq("user_id", user.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: `Reclasificado a ${newCategory}`,
      id: body.id,
      category: newCategory,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
