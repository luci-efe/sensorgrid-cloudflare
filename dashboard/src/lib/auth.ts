import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_URL ?? '',
});

export const { signIn, signOut, useSession } = authClient;

/** Returns the raw session token for use as a Bearer token in Worker API calls. */
export async function getSessionToken(): Promise<string | null> {
  const result = await authClient.getSession();
  return (result as any)?.data?.session?.token ?? null;
}
