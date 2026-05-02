import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";

/** GET: fetch weight logs for the current user (last N days)
 *  POST: log a new weight entry
 *  PATCH: update an existing weight entry
 */

export const GET: APIRoute = async ({ locals, url }) => {
  const { user, accessToken } = locals;
  if (!user || !accessToken) return new Response("Unauthorized", { status: 401 });

  const supabase = createAuthClient(accessToken);
  const days = parseInt(url.searchParams.get("days") || "30");

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0];

  const [logsRes, goalRes] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("log_date", sinceStr)
      .order("log_date", { ascending: true })
      .order("time_of_day", { ascending: true }),
    supabase
      .from("weight_goals")
      .select("goal_kg")
      .eq("user_id", user.id)
      .single(),
  ]);

  return new Response(
    JSON.stringify({
      logs: logsRes.data || [],
      goal: goalRes.data?.goal_kg ?? null,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const POST: APIRoute = async ({ request, locals }) => {
  const { user, accessToken, userRole } = locals;
  if (!user || !accessToken) return new Response("Unauthorized", { status: 401 });
  if (userRole === "admin") return new Response("Admin is read-only", { status: 403 });

  const supabase = createAuthClient(accessToken);
  const body = await request.json();
  const { log_date, time_of_day, weight_kg } = body;

  if (!log_date || !time_of_day || !weight_kg) {
    return new Response("Missing fields", { status: 400 });
  }

  if (!["morning", "night"].includes(time_of_day)) {
    return new Response("Invalid time_of_day", { status: 400 });
  }

  const weight = parseFloat(weight_kg);
  if (isNaN(weight) || weight < 20 || weight > 300) {
    return new Response("Invalid weight", { status: 400 });
  }

  // Upsert: update if exists for same user/date/time, otherwise insert
  const { data, error } = await supabase
    .from("weight_logs")
    .upsert(
      {
        user_id: user.id,
        log_date,
        time_of_day,
        weight_kg: weight,
      },
      { onConflict: "user_id,log_date,time_of_day" }
    )
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, log: data }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  const { user, accessToken, userRole } = locals;
  if (!user || !accessToken) return new Response("Unauthorized", { status: 401 });
  if (userRole === "admin") return new Response("Admin is read-only", { status: 403 });

  const supabase = createAuthClient(accessToken);
  const body = await request.json();
  const { action, goal_kg } = body;

  if (action === "set_goal") {
    const goal = parseFloat(goal_kg);
    if (isNaN(goal) || goal < 20 || goal > 300) {
      return new Response("Invalid goal", { status: 400 });
    }

    const { error } = await supabase.from("weight_goals").upsert(
      { user_id: user.id, goal_kg: goal, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Unknown action", { status: 400 });
};
