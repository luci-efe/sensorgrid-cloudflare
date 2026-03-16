import { createAuthClient } from 'better-auth/react';

// Use same-origin /auth path (proxied via Pages Functions) to avoid
// third-party cookie blocking on mobile Safari and other strict browsers.
// Falls back to VITE_AUTH_URL for local dev if set.
const authBaseURL = import.meta.env.VITE_AUTH_URL?.startsWith('http')
  ? import.meta.env.VITE_AUTH_URL
  : '/auth';

export const authClient = createAuthClient({
  baseURL: authBaseURL,
});

export const { signIn, signOut, useSession } = authClient;

/** Returns the raw session token for use as a Bearer token in Worker API calls. */
export async function getSessionToken(): Promise<string | null> {
  const result = await authClient.getSession();
  return (result as any)?.data?.session?.token ?? null;
}
