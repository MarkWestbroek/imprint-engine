import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { corsHeadersFor } from "../src/media/cors";

/** One CORS policy for /api/media, /api/patches and /api/assets: listed
 *  origins get everything, every origin may read without a token. */
const offer = { methods: "GET, POST, OPTIONS", headers: "Authorization, Content-Type", publicHeaders: "Range" };
const req = (method: string, headers: Record<string, string> = {}) => new Request("https://musicbrain.nl/api/patches", { method, headers });
const listed = ["https://editor.musicbrain.nl"];

describe("corsHeadersFor", () => {
  it("gives a listed origin the full offer", () => {
    const h = corsHeadersFor(listed, req("POST", { origin: "https://editor.musicbrain.nl", authorization: "Bearer x" }), offer);
    assert.equal(h["Access-Control-Allow-Origin"], "https://editor.musicbrain.nl");
    assert.equal(h["Access-Control-Allow-Methods"], "GET, POST, OPTIONS");
    assert.equal(h["Access-Control-Allow-Headers"], "Authorization, Content-Type");
  });

  it("lets any origin read without a token (the public pools from localhost)", () => {
    const h = corsHeadersFor(listed, req("GET", { origin: "http://localhost:5173" }), offer);
    assert.equal(h["Access-Control-Allow-Origin"], "*");
    assert.equal(h["Access-Control-Allow-Methods"], "GET, HEAD, OPTIONS");
    assert.equal(h["Access-Control-Allow-Headers"], "Range");
  });

  it("answers the preflight of a plain GET from an unlisted origin", () => {
    const h = corsHeadersFor(listed, req("OPTIONS", { origin: "https://192.168.2.10:5174", "access-control-request-method": "GET", "access-control-request-headers": "range" }), offer);
    assert.equal(h["Access-Control-Allow-Origin"], "*");
  });

  it("blocks a token or a write from an unlisted origin", () => {
    for (const r of [
      req("GET", { origin: "http://localhost:5173", authorization: "Bearer x" }),
      req("OPTIONS", { origin: "http://localhost:5173", "access-control-request-method": "GET", "access-control-request-headers": "Authorization" }),
      req("POST", { origin: "http://localhost:5173" }),
      req("OPTIONS", { origin: "http://localhost:5173", "access-control-request-method": "POST" }),
    ]) {
      assert.equal(corsHeadersFor(listed, r, offer)["Access-Control-Allow-Origin"], undefined);
    }
  });

  it("does nothing for a same-origin request (no Origin header)", () => {
    assert.deepEqual(corsHeadersFor(listed, req("GET"), offer), {});
  });
});
