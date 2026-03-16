// Cloudflare Pages Function: proxies /auth/* to the Worker's /auth/* endpoint.
// This makes auth cookies same-origin (sensorgrid.site), fixing mobile Safari
// which blocks third-party cookies from the Worker's different domain.

const WORKER_URL = 'https://sensorgrid-ingest.lfernando-rramos.workers.dev';

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const targetUrl = `${WORKER_URL}${url.pathname}${url.search}`;

  const headers = new Headers(context.request.headers);
  // Set Origin to the worker's origin so it passes CORS checks
  headers.set('Origin', WORKER_URL);

  const res = await fetch(targetUrl, {
    method: context.request.method,
    headers,
    body: context.request.method !== 'GET' && context.request.method !== 'HEAD'
      ? context.request.body
      : undefined,
  });

  // Copy response headers, but ensure cookies are scoped to our own domain
  const resHeaders = new Headers();
  for (const [k, v] of res.headers.entries()) {
    const lower = k.toLowerCase();
    if (lower === 'set-cookie') {
      // Remove Domain and SameSite — cookie will default to sensorgrid.site (same-origin)
      let clean = v.replace(/;\s*domain=[^;]*/i, '');
      clean = clean.replace(/;\s*samesite=[^;]*/i, '');
      // Same-origin cookie: Lax is fine and works on all browsers
      clean += '; SameSite=Lax; Secure';
      resHeaders.append('Set-Cookie', clean);
    } else if (lower === 'access-control-allow-origin') {
      // Skip — not needed for same-origin
    } else {
      resHeaders.set(k, v);
    }
  }

  return new Response(res.body, {
    status: res.status,
    headers: resHeaders,
  });
};
