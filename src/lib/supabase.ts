import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.SUPABASE_URL,
  import.meta.env.SUPABASE_ANON_KEY,
  {
    auth: {
      flowType: "pkce",
    },
  },
);

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
