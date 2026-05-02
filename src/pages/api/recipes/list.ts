import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

export const GET: APIRoute = async ({ locals, url }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAuthClient(locals.accessToken);
  const mealTypeId = url.searchParams.get("meal_type_id");

  let query = supabase
    .from("recipes")
    .select(`
      id,
      title,
      description,
      meal_type_id,
      servings,
      calories_per_serving,
      protein_g,
      carbs_g,
      fat_g,
      health_note,
      instructions,
      created_by,
      created_at,
      recipe_ingredients(name, quantity, unit, source, estimated_calories)
    `)
    .order("created_at", { ascending: false })
    .limit(12);

  if (mealTypeId) {
    query = query.eq("meal_type_id", mealTypeId);
  }

  const { data, error } = await query;

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const recipes = (data || []).map((recipe: any) => ({
    ...recipe,
    can_delete: recipe.created_by === user.id,
  }));

  return new Response(JSON.stringify(recipes), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ locals, request }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (locals.userRole === "admin") {
    return new Response("Admin is read-only", { status: 403 });
  }

  const supabase = createAuthClient(locals.accessToken);

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";

    if (!id) {
      return new Response("id required", { status: 400 });
    }

    const { error } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id)
      .eq("created_by", user.id);

    if (error) {
      return new Response(error.message, { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(error.message || "Invalid request", { status: 400 });
  }
};