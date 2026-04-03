import { defineMiddleware } from "astro:middleware";
import { getSession } from "./lib/auth";

const PUBLIC_ROUTES = ["/signin", "/api/auth/signin", "/api/auth/callback", "/api/auth/signout"];

export const onRequest = defineMiddleware(async ({ cookies, url, redirect, locals }, next) => {
  // Allow public routes
  if (PUBLIC_ROUTES.some(route => url.pathname.startsWith(route))) {
    locals.session = null;
    locals.user = null;
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

  return next();
});
