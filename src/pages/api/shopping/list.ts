import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

// GET — fetch items by list_type (comida/aseo), optionally filter by is_bought
export const GET: APIRoute = async ({ url, locals }) => {
  const user = locals.user;
  if (!user || !locals.accessToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAuthClient(locals.accessToken);
  const listType = url.searchParams.get("list_type");
  if (!listType || (listType !== "comida" && listType !== "aseo")) {
    return new Response("list_type must be comida or aseo", { status: 400 });
  }

  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("*, profiles:created_by(display_name, avatar_url)")
    .eq("list_type", listType)
    .order("is_bought", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// POST — add item to shopping list
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
    const { name, list_type, quantity } = body;

    if (!name || !list_type) {
      return new Response("name and list_type required", { status: 400 });
    }
    if (list_type !== "comida" && list_type !== "aseo") {
      return new Response("list_type must be comida or aseo", { status: 400 });
    }

    const { data, error } = await supabase
      .from("shopping_list_items")
      .insert({
        name: name.trim(),
        list_type,
        quantity: quantity || 1,
        created_by: user.id,
      })
      .select("*, profiles:created_by(display_name, avatar_url)")
      .single();

    if (error) {
      return new Response(error.message, { status: 500 });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(e.message || "Invalid request", { status: 400 });
  }
};

// PATCH — mark as bought (with price) or toggle back to pending
export const PATCH: APIRoute = async ({ request, locals }) => {
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
    const { id, is_bought, bought_price } = body;

    if (!id) {
      return new Response("id required", { status: 400 });
    }

    const update: Record<string, unknown> = { is_bought: !!is_bought };
    if (is_bought) {
      update.bought_price = bought_price ?? null;
      update.bought_at = new Date().toISOString();
      update.bought_by = user.id;
    } else {
      update.bought_price = null;
      update.bought_at = null;
      update.bought_by = null;
    }

    const { data, error } = await supabase
      .from("shopping_list_items")
      .update(update)
      .eq("id", id)
      .select("*, profiles:created_by(display_name, avatar_url)")
      .single();

    if (error) {
      return new Response(error.message, { status: 500 });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(e.message || "Invalid request", { status: 400 });
  }
};

// DELETE — remove an item
export const DELETE: APIRoute = async ({ request, locals }) => {
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
    const { id } = body;

    if (!id) {
      return new Response("id required", { status: 400 });
    }

    const { error } = await supabase
      .from("shopping_list_items")
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
    return new Response(e.message || "Invalid request", { status: 400 });
  }
};
