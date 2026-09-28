import { authFile } from "./env";
import { expect, test } from "./test";

test.use({ storageState: authFile("editor") });

/**
 * The external media API (design/beeldbibliotheek.md §12.4), the way the
 * MusicBrain patch editor uses it: a personal token made on the account
 * screen, then one POST per recording — wav + mid + patch.json as one group —
 * from another origin, without cookies. Also: the CORS preflight, listing,
 * all-or-nothing on a bad file, missing scope, and revoking.
 */
test.describe.configure({ mode: "serial" });

const ORIGIN = "http://editor.e2e.test";
const GROUP = "e2e-api-take-1";
let token = "";
let readOnly = "";

function wav(seconds: number): Buffer {
  const rate = 48000;
  const bytes = rate * 2 * 3 * seconds;
  const b = Buffer.alloc(44 + bytes);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(36 + bytes, 4);
  b.write("WAVEfmt ", 8, "latin1");
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 6, 28);
  b.writeUInt16LE(6, 32);
  b.writeUInt16LE(24, 34);
  b.write("data", 36, "latin1");
  b.writeUInt32LE(bytes, 40);
  return b;
}

function recording(): FormData {
  const fd = new FormData();
  fd.append("file[]", new Blob([new Uint8Array(wav(1))], { type: "audio/wav" }), `${GROUP}.wav`);
  fd.append("file[]", new Blob([new Uint8Array(Buffer.from("4d546864000000060001000301e0", "hex"))], { type: "audio/midi" }), `${GROUP}.mid`);
  fd.append("file[]", new Blob([JSON.stringify({ type: "mmb-patch", modules: [{ id: "vco1" }] })], { type: "application/json" }), `${GROUP}.patch.json`);
  fd.append("folder", "opnames/sim");
  fd.append("tags[]", "sim-opname");
  fd.append("group", GROUP);
  fd.append("exif", "none");
  return fd;
}

test.describe("media API", () => {
  test("make a token on the account screen: shown once, listed by its prefix", async ({ page }) => {
    await page.goto("/admin/users");
    const section = page.getByRole("region", { name: "API tokens" });
    await section.getByLabel("New token for").fill("patch editor");
    await section.getByRole("button", { name: "Create token" }).click();
    token = (await page.getByTestId("new-token").textContent())!.trim();
    expect(token).toMatch(/^imp_/);
    await expect(section.getByRole("cell", { name: `${token.slice(0, 12)}…` })).toBeVisible();

    // A second, read-only token, to prove scopes.
    await section.getByLabel("New token for").fill("read only");
    await section.getByLabel("upload media").uncheck();
    await section.getByRole("button", { name: "Create token" }).click();
    await expect(page.getByTestId("new-token")).not.toHaveText(token);
    readOnly = (await page.getByTestId("new-token").textContent())!.trim();
  });

  test("the preflight answers the listed origin only", async ({ playwright, baseURL }) => {
    const api = await playwright.request.newContext({ baseURL });
    const ok = await api.fetch("/api/media", { method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST" } });
    expect(ok.status()).toBe(204);
    expect(ok.headers()["access-control-allow-origin"]).toBe(ORIGIN);
    expect(ok.headers()["access-control-allow-headers"]).toContain("Authorization");
    const other = await api.fetch("/api/media", { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
    expect(other.headers()["access-control-allow-origin"]).toBeUndefined();
    await api.dispose();
  });

  test("one POST puts a recording in the library as one group", async ({ playwright, baseURL, page }) => {
    const api = await playwright.request.newContext({ baseURL });
    const res = await api.post("/api/media", { headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN }, multipart: recording() });
    expect(res.status()).toBe(201);
    expect(res.headers()["access-control-allow-origin"]).toBe(ORIGIN);
    const body = (await res.json()) as { assets: { slug: string; kind: string; url: string; group?: string }[] };
    expect(body.assets.map((a) => a.kind)).toEqual(["audio", "data", "data"]);
    expect(body.assets.every((a) => a.group === GROUP)).toBe(true);
    expect(body.assets[0].url).toMatch(/^http:\/\/.+\/api\/assets\/library\/.+\.wav$/);
    // The files are there, for anyone (the assets are public) — and the editor may fetch() them.
    expect((await api.get(body.assets[0].url)).status()).toBe(200);
    const patch = await api.get(body.assets[2].url, { headers: { Origin: ORIGIN } });
    expect(patch.headers()["access-control-allow-origin"]).toBe(ORIGIN);
    expect(((await patch.json()) as { type: string }).type).toBe("mmb-patch");
    const part = await api.get(body.assets[0].url, { headers: { Origin: ORIGIN, Range: "bytes=0-11" } });
    expect(part.status()).toBe(206);
    expect(part.headers()["access-control-expose-headers"]).toContain("Content-Range");

    const list = await api.get(`/api/media?group=${GROUP}`, { headers: { Authorization: `Bearer ${readOnly}` } });
    expect(list.status()).toBe(200);
    const listed = (await list.json()) as { assets: { folder: string; tags: string[] }[] };
    expect(listed.assets).toHaveLength(3);
    expect(listed.assets[0]).toMatchObject({ folder: "opnames/sim", tags: ["sim-opname"] });
    await api.dispose();

    // And in the admin it is one card in its folder.
    await page.goto("/admin/asset");
    await page.getByRole("navigation", { name: "Folders" }).getByRole("button", { name: /^Folder opnames\/sim,/ }).click();
    await expect(page.getByRole("button", { name: new RegExp(`${GROUP}$`) })).toContainText("3 files");
  });

  test("all or nothing: one bad file refuses the whole upload (415), nothing is stored", async ({ playwright, baseURL }) => {
    const api = await playwright.request.newContext({ baseURL });
    const fd = new FormData();
    fd.append("file[]", new Blob([new Uint8Array(wav(1))]), "e2e-half.wav");
    fd.append("file[]", new Blob([new Uint8Array(Buffer.from("MZ not a file we know"))]), "e2e-half.exe");
    fd.append("group", "e2e-half");
    const res = await api.post("/api/media", { headers: { Authorization: `Bearer ${token}` }, multipart: fd });
    expect(res.status()).toBe(415);
    expect(((await res.json()) as { file: string }).file).toBe("e2e-half.exe");
    const list = await api.get("/api/media?group=e2e-half", { headers: { Authorization: `Bearer ${token}` } });
    expect(((await list.json()) as { assets: unknown[] }).assets).toHaveLength(0);
    await api.dispose();
  });

  test("401 without a token, 403 without the scope, 401 once revoked", async ({ playwright, baseURL, page }) => {
    const api = await playwright.request.newContext({ baseURL });
    expect((await api.post("/api/media", { multipart: recording() })).status()).toBe(401);
    expect((await api.post("/api/media", { headers: { Authorization: `Bearer ${readOnly}` }, multipart: recording() })).status()).toBe(403);

    await page.goto("/admin/users");
    await page.getByRole("button", { name: "Revoke patch editor" }).click();
    await expect(page.getByRole("button", { name: "Revoke patch editor" })).toHaveCount(0);
    expect((await api.get("/api/media", { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401);
    await api.dispose();
  });
});
