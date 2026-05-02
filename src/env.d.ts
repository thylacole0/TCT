/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly VAPID_PUBLIC_KEY?: string;
  readonly VAPID_PRIVATE_KEY?: string;
  readonly CRON_SECRET?: string;
  readonly GEMINI_API_KEY?: string;
  readonly AI_PROVIDER?: string;
  readonly AI_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    session: import("@supabase/supabase-js").Session | null;
    user: import("@supabase/supabase-js").User | null;
    accessToken: string | null;
    userRole: 'member' | 'admin' | null;
  }
}
