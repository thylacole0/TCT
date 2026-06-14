import { createAuthClient } from "./supabase";

export type UserMetadata = Record<string, unknown>;

type UserLike = {
  user_metadata?: UserMetadata | null;
} | null | undefined;

export async function getFreshUserMetadata(accessToken: string, fallbackUser?: UserLike): Promise<UserMetadata> {
  const fallback = fallbackUser?.user_metadata || {};

  try {
    const client = createAuthClient(accessToken);
    const { data, error } = await client.auth.getUser(accessToken);
    if (error) return fallback;
    return (data.user?.user_metadata as UserMetadata | undefined) || fallback;
  } catch {
    return fallback;
  }
}
