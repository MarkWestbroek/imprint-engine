import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, describe, it } from "node:test";

import { omniumBaseUrl, omniumRequest, renderOmniumSvg } from "../src/omnium";
import { sanitizeSvg } from "../src/svg-sanitize";

/** Recorded from the Omnium sidecar: MusicBrain's content model, domein=catalogus. */
const fixture = () => readFile(new URL("./fixtures/omnium-musicbrain-catalogus.svg", import.meta.url), "utf8");

describe("sanitizeSvg", () => {
  it("leaves an Omnium diagram byte for byte intact", async () => {
    const svg = await fixture();
    assert.equal(sanitizeSvg(svg), svg.trim());
  });

  it("drops scripts, foreign content, handlers and external references", () => {
    const out = sanitizeSvg(
      '<?xml version="1.0"?><!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="x()">' +
        '<script>alert(1)</script><foreignObject><div>hi</div></foreignObject><style>*{}</style>' +
        '<image href="https://evil.test/a.png"/><!-- note -->' +
        '<rect width="1" height="1" onclick="x()" style="fill:red" fill="url(https://evil.test/#p)"/>' +
        '<a href="javascript:alert(1)"><text x="1">A</text></a>' +
        '<a href="/model/Product"><text x="1">B &amp; C</text></a>' +
        '<use href="https://evil.test/s.svg#i"/><use href="#i"/>' +
        '<path d="M0,0" marker-start="url(#mk)"/></svg>'
    );
    assert.equal(
      out,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">' +
        '<rect width="1" height="1"/>' +
        '<a><text x="1">A</text></a>' +
        '<a href="/model/Product"><text x="1">B &amp; C</text></a>' +
        '<use/><use href="#i"/>' +
        '<path d="M0,0" marker-start="url(#mk)"/></svg>'
    );
  });

  it("fails closed on anything that is not a well-formed svg document", () => {
    assert.equal(sanitizeSvg("<html><svg/></html>"), null);
    assert.equal(sanitizeSvg("<svg><g></svg>"), null);
    assert.equal(sanitizeSvg("<svg></svg><svg></svg>"), null);
    assert.equal(sanitizeSvg("text <svg></svg>"), null);
    assert.equal(sanitizeSvg("<svg><rect disabled></svg>"), null);
  });

  it("catches entity-encoded javascript: links", () => {
    assert.equal(sanitizeSvg('<svg><a href="jav&#x61;script:x()">x</a></svg>'), "<svg><a>x</a></svg>");
  });
});

describe("omniumRequest", () => {
  it("model-link: GET with name, version, as-of and view as query", () => {
    const { url, init } = omniumRequest(
      "https://omnium.test",
      { kind: "link", naam: "np-loc + register", versie: "2.1", asOf: "2026-09-01T00:00:00Z" },
      { domein: "catalogus", richting: "LR", velden: false }
    );
    assert.equal(init.method, "GET");
    assert.equal(
      url,
      "https://omnium.test/api/models/np-loc%20%2B%20register/diagram.svg?versie=2.1&asOf=2026-09-01T00%3A00%3A00Z&theme=auto&domein=catalogus&richting=LR&velden=false"
    );
  });

  it("model-code: POST with the code; a diagram wins over a domain", () => {
    const { url, init } = omniumRequest("https://omnium.test", { kind: "code", code: "{}" }, { diagram: "Overzicht", domein: "x" });
    assert.equal(url, "https://omnium.test/api/render/svg");
    assert.deepEqual(JSON.parse(String(init.body)), { taal: "v3", code: "{}", theme: "auto", diagram: "Overzicht" });
  });

  it("reads OMNIUM_URL without a trailing slash", () => {
    assert.equal(omniumBaseUrl({ OMNIUM_URL: " http://127.0.0.1:8095/ " }), "http://127.0.0.1:8095");
    assert.equal(omniumBaseUrl({}), undefined);
  });
});

describe("renderOmniumSvg", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const answer = (body: string, status = 200) => {
    globalThis.fetch = (async () => new Response(body, { status })) as typeof fetch;
  };
  const source = { kind: "model", model: {} } as const;

  it("returns the sanitised svg", async () => {
    answer('<svg viewBox="0 0 1 1"><script>x</script><rect width="1"/></svg>');
    assert.deepEqual(await renderOmniumSvg("https://o.test", source, {}), { svg: '<svg viewBox="0 0 1 1"><rect width="1"/></svg>' });
  });

  it("passes Omnium's problem on, with the views it offers", async () => {
    answer(
      JSON.stringify({ type: "urn:omnium:render:ongeldige-parameter", title: "Ongeldige parameter", status: 400, detail: "Kies een diagram of een domein.", diagrammen: [], domeinen: ["catalogus", "site"] }),
      400
    );
    assert.deepEqual(await renderOmniumSvg("https://o.test", source, {}), {
      problem: { status: 400, detail: "Kies een diagram of een domein.", element: undefined, pad: undefined, regel: undefined, kolom: undefined, diagrammen: [], domeinen: ["catalogus", "site"] },
    });
  });

  it("reports an unreachable server and a body that is no svg", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    const down = await renderOmniumSvg("https://o.test", source, {});
    assert.ok("problem" in down && down.problem.status === 0 && down.problem.detail.includes("ECONNREFUSED"));
    answer("<html>login</html>");
    const html = await renderOmniumSvg("https://o.test", source, {});
    assert.ok("problem" in html && html.problem.detail === "Omnium returned no usable SVG.");
  });
});
