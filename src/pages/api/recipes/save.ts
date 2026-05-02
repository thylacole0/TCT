import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { parseMealSuggestionResponse } from "../../../lib/ai/schemas";
import { normalizeFoodName } from "../../../lib/food/normalization";

export const POST: APIRoute = async ({ request, locals }) => {
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
    const mealTypeId = typeof body.meal_type_id === "string" ? body.meal_type_id : null;
    const aiGenerationId = typeof body.ai_generation_id === "string" ? body.ai_generation_id : null;
    const parsed = parseMealSuggestionResponse({ suggestions: [body.suggestion] });
    const suggestion = parsed.suggestions[0];

    const { data: existingRecipe, error: existingError } = await supabase
      .from("recipes")
      .select("id")
      .eq("created_by", user.id)
      .eq("title", suggestion.title)
      .maybeSingle();

    if (existingError) {
      return new Response(existingError.message, { status: 500 });
    }
    if (existingRecipe?.id) {
      return new Response(JSON.stringify({ success: true, recipe_id: existingRecipe.id, existing: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: recipe, error } = await supabase
      .from("recipes")
      .insert({
        title: suggestion.title,
        description: suggestion.health_note,
        meal_type_id: mealTypeId,
        source: "ai",
        created_by: user.id,
        servings: suggestion.servings,
        calories_per_serving: suggestion.calories_per_serving,
        protein_g: suggestion.protein_g,
        carbs_g: suggestion.carbs_g,
        fat_g: suggestion.fat_g,
        health_note: suggestion.health_note,
        instructions: suggestion.steps,
        ai_generation_id: aiGenerationId,
      })
      .select("id")
      .single();

    if (error || !recipe?.id) {
      return new Response(error?.message || "No se pudo guardar la receta", { status: 500 });
    }

    const { error: ingredientsError } = await supabase.from("recipe_ingredients").insert(
      suggestion.ingredients.map((ingredient) => ({
        recipe_id: recipe.id,
        name: ingredient.name,
        normalized_name: normalizeFoodName(ingredient.name),
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        estimated_calories: ingredient.estimated_calories,
        source: ingredient.source,
      }))
    );

    if (ingredientsError) {
      await supabase.from("recipes").delete().eq("id", recipe.id);
      return new Response(ingredientsError.message, { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, recipe_id: recipe.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(error.message || "Invalid request", { status: 400 });
  }
};