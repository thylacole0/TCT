import type { APIRoute } from "astro";
import { createServerClient } from "../../../lib/supabase";

export const GET: APIRoute = async ({ request, url, cookies, redirect }) => {
  const authCode = url.searchParams.get("code");

  if (!authCode) {
    return new Response("No code provided", { status: 400 });
  }

  const supabase = createServerClient(request, cookies);
  const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const { access_token, refresh_token } = data.session;

  // Sync avatar from OAuth provider
  const avatarUrl = data.user?.user_metadata?.avatar_url;
  if (avatarUrl) {
    const authClient = (await import("../../../lib/supabase")).createAuthClient(access_token);
    await authClient.from("profiles").update({ avatar_url: avatarUrl }).eq("id", data.user.id);
  }

  cookies.set("sb-access-token", access_token, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days — middleware auto-refreshes before expiry
  });
  cookies.set("sb-refresh-token", refresh_token, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return redirect("/");
};
