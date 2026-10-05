/**
 * CORS for the public APIs (/api/media, /api/patches, /api/assets): one
 * policy, three routes. Asked for by the site owner (MusicBrain, 2026-10-05):
 * the public pools are public, so the editor on localhost or on a phone must
 * be able to read them without first being put on a list.
 *
 * - An origin on the site's list (`media.cors` in imprint.config.ts) gets the
 *   full offer: the methods and headers the route has, so the patch editor on
 *   editor.musicbrain.nl can upload and propose with its token.
 * - Any other origin may *read without a token*: a `GET` (or its preflight)
 *   without an `Authorization` header is answered with `*`. The browser never
 *   sends credentials with `*`, so a visitor's session is not involved, and
 *   what the anonymous reader may not see stays 403 for that origin as well.
 * - Anything else from an unlisted origin gets no CORS headers, so the browser
 *   blocks it before a token could travel.
 */
export interface CorsOffer {
  /** What a listed origin may do, e.g. "GET, POST, OPTIONS". */
  methods: string;
  /** Request headers a listed origin may send, e.g. "Authorization, Content-Type". */
  headers: string;
  /** Request headers everyone may send on a public read (e.g. "Range"). */
  publicHeaders?: string;
  /** Response headers to expose (both cases). */
  expose?: string;
}

const TOKEN_HEADER = "authorization";

function asksForToken(req: Request): boolean {
  if (req.headers.has(TOKEN_HEADER)) return true;
  const wanted = req.headers.get("access-control-request-headers") ?? "";
  return wanted.split(",").some((h) => h.trim().toLowerCase() === TOKEN_HEADER);
}

function isPublicRead(req: Request): boolean {
  const method = req.method === "OPTIONS" ? (req.headers.get("access-control-request-method") ?? "") : req.method;
  return (method === "GET" || method === "HEAD") && !asksForToken(req);
}

/** The CORS response headers for `req`, or `{}` when the browser must block it. */
export function corsHeadersFor(allowed: readonly string[], req: Request, offer: CorsOffer): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin) return {};
  const out: Record<string, string> = {};
  if (allowed.includes(origin)) {
    out["Access-Control-Allow-Origin"] = origin;
    out["Access-Control-Allow-Methods"] = offer.methods;
    out["Access-Control-Allow-Headers"] = offer.headers;
  } else if (isPublicRead(req)) {
    out["Access-Control-Allow-Origin"] = "*";
    out["Access-Control-Allow-Methods"] = "GET, HEAD, OPTIONS";
    if (offer.publicHeaders) out["Access-Control-Allow-Headers"] = offer.publicHeaders;
  } else {
    // A listed origin and a public reader get different answers: keep caches apart.
    return allowed.length > 0 ? { Vary: "Origin" } : {};
  }
  out["Access-Control-Max-Age"] = "600";
  if (offer.expose) out["Access-Control-Expose-Headers"] = offer.expose;
  out.Vary = "Origin";
  return out;
}
