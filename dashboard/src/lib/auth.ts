import { createAuthClient } from 'better-auth/react';

// Use same-origin /auth path (proxied via Pages Functions) to avoid
// third-party cookie blocking on mobile Safari and other strict browsers.
const rawAuthURL = import.meta.env.VITE_AUTH_URL ?? '/auth';
// Better Auth requires a full URL, so resolve relative paths against origin
const authBaseURL = rawAuthURL.startsWith('http')
  ? rawAuthURL
  : `${window.location.origin}${rawAuthURL}`;

export const authClient = createAuthClient({
  baseURL: authBaseURL,
});

export const { signIn, signOut, useSession } = authClient;

/** Returns the raw session token for use as a Bearer token in Worker API calls. */
export async function getSessionToken(): Promise<string | null> {
  const result = await authClient.getSession();
  return (result as any)?.data?.session?.token ?? null;
}
