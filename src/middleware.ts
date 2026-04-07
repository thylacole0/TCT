import { defineMiddleware } from "astro:middleware";
import { getSession } from "./lib/auth";
import { createAuthClient } from "./lib/supabase";

const PUBLIC_ROUTES = ["/signin", "/api/auth/signin", "/api/auth/callback", "/api/auth/signout"];

// Routes that need the user role (admin guard or read-only UI)
const ROLE_ROUTES = ["/api/", "/finanzas"];

export const onRequest = defineMiddleware(async ({ cookies, url, redirect, locals }, next) => {
  // Allow public routes
  if (PUBLIC_ROUTES.some(route => url.pathname.startsWith(route))) {
    locals.session = null;
    locals.user = null;
    locals.userRole = null;
    return next();
  }

  // Check session — single call, result stored in locals for all downstream use
  const data = await getSession(cookies);

  if (!data || !data.user) {
    return redirect("/signin");
  }

  locals.session = data.session;
  locals.user = data.user;
  locals.accessToken = data.session?.access_token ?? null;

  // Only fetch role for routes that need it (API guards + finanzas read-only)
  if (ROLE_ROUTES.some(route => url.pathname.startsWith(route))) {
    // Check cookie cache first
    const cachedRole = cookies.get('tct-role')?.value;
    if (cachedRole === 'member' || cachedRole === 'admin') {
      locals.userRole = cachedRole;
    } else {
      const supabase = createAuthClient(data.session!.access_token);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
      const role = (profile?.role as 'member' | 'admin') ?? 'member';
      locals.userRole = role;
      cookies.set('tct-role', role, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 3600, // 1 hour cache
      });
    }
  } else {
    locals.userRole = null;
  }

  return next();
});
