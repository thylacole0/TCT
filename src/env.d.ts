/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    session: import("@supabase/supabase-js").Session | null;
    user: import("@supabase/supabase-js").User | null;
    accessToken: string | null;
  }
}
