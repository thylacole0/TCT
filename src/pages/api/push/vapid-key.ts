import type { APIRoute } from "astro";

/** GET: return the VAPID public key so the client can subscribe */
export const GET: APIRoute = async () => {
  const publicKey = import.meta.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return new Response("VAPID key not configured", { status: 500 });
  }
  return new Response(JSON.stringify({ publicKey }), {
    headers: { "Content-Type": "application/json" },
  });
};
