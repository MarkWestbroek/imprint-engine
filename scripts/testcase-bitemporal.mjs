#!/usr/bin/env node
/**
 * MMB-testcase "oude releases en versies blijven benaderbaar" als
 * herhaalbaar script (docs/testcases/oude-releases-blijven-benaderbaar.md).
 * Read-only — veilig tegen productie.
 *
 *   npm run testcase:bitemporal -- https://musicbrain.nl adc8@v1.2
 *
 * Asserts: (1) de release-lijst is niet leeg en bevat >1 release,
 * (2) het component heeft de oude versie nog naast nieuwere, mét spec-ref,
 * (3) de oude board-spec is opvraagbaar en al zijn content-hashed
 * asset-URL's geven HTTP 200.
 */
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const [component, oldVersion] = (process.argv[3] ?? "adc8@v1.2").split("@");
const specSlug = `${component}@${oldVersion}`;

let failed = 0;
const assert = (ok, name, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
};
const getJson = async (path) => {
  const res = await fetch(base + path, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.json();
};

try {
  // 1. release-lijst: meerdere releases naast elkaar (niets verdrongen)
  const releases = await getJson("/api/content/releases");
  assert(
    Array.isArray(releases) && releases.length > 1,
    "release-lijst bevat meerdere releases",
    releases.map((r) => `${r.project} ${r.version}`).join(", ")
  );

  // 2. component houdt de oude versie, met spec-verwijzing
  const comp = await getJson(`/api/content/components/${component}`);
  const old = comp.versions.find((v) => v.number === oldVersion);
  assert(
    Boolean(old),
    `component ${component} heeft versie ${oldVersion} nog`,
    `versies: ${comp.versions.map((v) => v.number).join(", ")}`
  );
  assert(Boolean(old?.spec), `versie ${oldVersion} verwijst naar spec`, old?.spec);

  // 3. oude spec + al zijn content-hashed assets blijven 200
  const spec = await getJson(`/api/content/board-specs/${encodeURIComponent(specSlug)}`);
  const urls = [
    spec.assets.renderTop,
    spec.assets.renderBottom,
    spec.assets.overview,
    ...Object.values(spec.assets.pinouts ?? {}),
  ].filter(Boolean);
  assert(urls.length > 0, `spec ${specSlug} heeft assets`, `${urls.length} stuks`);
  for (const u of urls) {
    const res = await fetch(base + u, { method: "HEAD", signal: AbortSignal.timeout(20_000) })
      .catch(() => ({ status: 0 }));
    // Sommige servers weigeren HEAD; val terug op GET.
    const status =
      res.status === 200 ? 200 : (await fetch(base + u, { signal: AbortSignal.timeout(20_000) })).status;
    assert(status === 200, `asset 200: ${u}`, status === 200 ? "" : `HTTP ${status}`);
  }
} catch (err) {
  assert(false, "onverwachte fout", String(err));
}

console.log(
  failed === 0
    ? `\nTestcase GESLAAGD — ${base} (${specSlug})`
    : `\n${failed} assert(s) GEFAALD — ${base} (${specSlug})`
);
process.exit(failed === 0 ? 0 : 1);
