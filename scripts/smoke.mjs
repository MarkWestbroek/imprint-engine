#!/usr/bin/env node
/**
 * Post-deploy smoke test: `npm run smoke -- https://musicbrain.nl`
 * (default: http://localhost:3000). Read-only — safe against production.
 * Exit code 1 when a check fails, so it can gate CI/deploys later.
 */
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

const checks = [
  { name: "home", path: "/", expect: (s, b) => s === 200 && b.includes("MusicBrain") },
  { name: "admin (login of dashboard)", path: "/admin", expect: (s) => s === 200 },
  {
    name: "content-API index",
    path: "/api/content",
    expect: (s, b) => s === 200 && b.includes('"endpoints"'),
  },
  { name: "producten via API", path: "/api/content/products", expect: (s, b) => s === 200 && b.startsWith("[") },
  { name: "releases-pagina", path: "/releases", expect: (s) => s === 200 },
  { name: "productpagina", path: "/products/cortex", expect: (s) => s === 200 },
  {
    name: "write-API dicht zonder token",
    path: "/api/content/product/smoke-test",
    method: "POST",
    body: "{}",
    expect: (s) => s === 401,
  },
  {
    name: "thema's actief ([data-theme]-CSS)",
    path: "/",
    warnOnly: true, // ontbreekt tot de thema's geseed zijn — waarschuwing, geen fout
    expect: (s, b) => s === 200 && b.includes("data-theme="),
  },
];

let failed = 0;
for (const c of checks) {
  let status = 0;
  let body = "";
  try {
    const res = await fetch(base + c.path, {
      method: c.method ?? "GET",
      body: c.body,
      headers: c.body ? { "Content-Type": "application/json" } : undefined,
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    status = res.status;
    body = await res.text();
  } catch (err) {
    body = String(err);
  }
  const ok = c.expect(status, body);
  const mark = ok ? "✓" : c.warnOnly ? "⚠" : "✗";
  if (!ok && !c.warnOnly) failed++;
  console.log(`${mark} ${c.name} (${status || "geen antwoord"})`);
}

console.log(failed === 0 ? `\nSmoke OK — ${base}` : `\n${failed} check(s) FAALDEN — ${base}`);
process.exit(failed === 0 ? 0 : 1);
