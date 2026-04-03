import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAuthClient(locals.accessToken);

  try {
    const body = await request.json();
    const { meal_date, meal_type_id, description } = body;

    if (!meal_date || !meal_type_id || !description) {
      return new Response("meal_date, meal_type_id, description required", {
        status: 400,
      });
    }

    // Upsert meal plan (one meal per day per type)
    const { data, error } = await supabase
      .from("meal_plans")
      .upsert(
        {
          meal_date,
          meal_type_id,
          description,
          created_by: user.id,
        },
        { onConflict: "meal_date,meal_type_id" }
      )
      .select("id")
      .single();

    if (error) {
      return new Response(error.message, { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(e.message || "Invalid request", { status: 400 });
  }
};

export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAuthClient(locals.accessToken);
  const weekStart = url.searchParams.get("week_start");
  if (!weekStart) {
    return new Response("week_start required", { status: 400 });
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("meal_plans")
    .select("*, meal_types(name, sort_order), profiles(display_name)")
    .gte("meal_date", weekStart)
    .lte("meal_date", weekEndStr)
    .order("meal_date")
    .order("meal_types(sort_order)");

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAuthClient(locals.accessToken);

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response("id required", { status: 400 });
    }

    const { error } = await supabase
      .from("meal_plans")
      .delete()
      .eq("id", id);

    if (error) {
      return new Response(error.message, { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(e.message, { status: 400 });
  }
};
