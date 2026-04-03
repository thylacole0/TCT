import { supabase } from "./supabase";
import type { AstroCookies } from "astro";

export async function getSession(cookies: AstroCookies) {
  const accessToken = cookies.get("sb-access-token");
  const refreshToken = cookies.get("sb-refresh-token");

  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data, error } = await supabase.auth.setSession({
    refresh_token: refreshToken.value,
    access_token: accessToken.value,
  });

  if (error) {
    cookies.delete("sb-access-token", { path: "/" });
    cookies.delete("sb-refresh-token", { path: "/" });
    return null;
  }

  // Update tokens if they were refreshed
  if (data.session) {
    cookies.set("sb-access-token", data.session.access_token, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
    cookies.set("sb-refresh-token", data.session.refresh_token, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  }

  return data;
}
