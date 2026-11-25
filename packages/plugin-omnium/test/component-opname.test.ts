import assert from "node:assert/strict";
import { test } from "node:test";
import { alsNaam, controleerOpname, geldigPatroon, imageZonderTag, isOpneembaar, voorstelVoor, type Opname } from "../src/component-opname";
import type { ScanComponent } from "../src/omgeving-scan";

const mailpit: ScanComponent = {
  namespace: "ns-a",
  naam: "mailpit",
  bron: "deployment",
  image: "docker.io/axllent/mailpit:v1.21",
  versie: "v1.21",
  herkend: null,
  bereikbaar: null,
};
const ctx = { bestaandeNamen: ["open-zaak", "Open-Klant"], lagen: ["1 interactie", "4 data"], scan: mailpit };

test("imageZonderTag strips tag and digest, keeps a registry port", () => {
  assert.equal(imageZonderTag("axllent/mailpit:v1.21"), "axllent/mailpit");
  assert.equal(imageZonderTag("reg.example:5000/a/b:1@sha256:abc"), "reg.example:5000/a/b");
  assert.equal(imageZonderTag("nginx"), "nginx");
});

test("voorstelVoor takes the plugin's proposal when there is one", () => {
  const v = voorstelVoor({ ...mailpit, voorstel: { componentNaam: "Mail Pit", soort: "image", patroon: "^axllent/mailpit$" } });
  assert.equal(v.naam, "mail-pit");
  assert.deepEqual(v.herkenning, { soort: "image", patroon: "^axllent/mailpit$" });
  assert.equal(v.doel, true);
  assert.equal(v.laag, "");
});

test("voorstelVoor derives name and an escaped, anchored pattern from the image otherwise", () => {
  const v = voorstelVoor(mailpit);
  assert.equal(v.naam, "mailpit");
  assert.equal(v.weergavenaam, "Mailpit");
  assert.deepEqual(v.herkenning, { soort: "image", patroon: "^docker\\.io/axllent/mailpit$" });
  assert.ok(new RegExp(v.herkenning.patroon).test("docker.io/axllent/mailpit"));
});

test("voorstelVoor uses the recognised name, and the chart without an image", () => {
  assert.equal(voorstelVoor({ ...mailpit, herkend: { componentNaam: "mailserver" } }).naam, "mailserver");
  assert.deepEqual(voorstelVoor({ ...mailpit, image: undefined, chart: "keycloak" }).herkenning, { soort: "chart", patroon: "^keycloak$" });
});

const goed: Opname = { ...voorstelVoor(mailpit), laag: "4 data" };

test("controleerOpname accepts a complete proposal", () => {
  assert.deepEqual(controleerOpname(goed, ctx), []);
  assert.ok(isOpneembaar(controleerOpname(goed, ctx)));
});

test("controleerOpname requires name, display name and a known layer", () => {
  const b = controleerOpname({ ...goed, naam: " ", weergavenaam: "", laag: "9 onzin" }, ctx);
  assert.deepEqual(b.map((x) => x.veld).sort(), ["laag", "naam", "weergavenaam"]);
  assert.equal(isOpneembaar(b), false);
});

test("controleerOpname refuses a malformed or existing name (case-insensitive)", () => {
  assert.equal(controleerOpname({ ...goed, naam: "Mail Pit" }, ctx)[0]?.veld, "naam");
  assert.match(controleerOpname({ ...goed, naam: "open-klant" }, ctx)[0]?.melding ?? "", /al een component/);
});

test("controleerOpname refuses an invalid regex and only warns when the pattern misses this workload", () => {
  assert.equal(geldigPatroon("^(a"), false);
  assert.equal(controleerOpname({ ...goed, herkenning: { soort: "image", patroon: "^(a" } }, ctx)[0]?.ernst, "fout");
  const b = controleerOpname({ ...goed, herkenning: { soort: "image", patroon: "^iets-anders$" } }, ctx);
  assert.equal(b.length, 1);
  assert.equal(b[0]?.ernst, "let op");
  assert.ok(isOpneembaar(b));
});

test("alsNaam makes register-style names", () => {
  assert.equal(alsNaam("  Open Zaak (ZGW) "), "open-zaak-zgw");
});
