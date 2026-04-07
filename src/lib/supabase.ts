import { createClient } from "@supabase/supabase-js";
import { createServerClient as createSSRClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";

export const supabase = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_ANON_KEY,
  {
    auth: {
      flowType: "pkce",
    },
  },
);

/** Create a Supabase SSR client that persists PKCE code verifier in cookies */
export function createServerClient(request: Request, cookies: AstroCookies) {
  return createSSRClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("Cookie") ?? "");
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookies.set(name, value, options)
            );
          } catch {
            // Ignore: async onAuthStateChange may fire after response is sent
          }
        },
      },
    },
  );
}

/** Create a Supabase client authenticated with the user's JWT — use for RLS-protected operations */
export function createAuthClient(accessToken: string) {
  return createClient(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );
}
