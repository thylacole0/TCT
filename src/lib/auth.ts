import { supabase } from "./supabase";
import type { AstroCookies } from "astro";

/** Decode JWT payload without verification (server validates via Supabase RLS) */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function getSession(cookies: AstroCookies) {
  const accessToken = cookies.get("sb-access-token");
  const refreshToken = cookies.get("sb-refresh-token");

  if (!accessToken || !refreshToken) {
    return null;
  }

  // Check if token is still valid (with 60s buffer)
  const payload = decodeJwtPayload(accessToken.value);
  const now = Math.floor(Date.now() / 1000);
  const needsRefresh = !payload || !payload.exp || payload.exp < now + 60;

  if (!needsRefresh && payload) {
    // Token still valid — skip network call to Supabase
    return {
      session: {
        access_token: accessToken.value,
        refresh_token: refreshToken.value,
        user: {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        },
      } as any,
      user: {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      } as any,
    };
  }

  // Token expired or about to — refresh via Supabase
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
