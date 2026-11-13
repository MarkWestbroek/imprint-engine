import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { ContentRecord, WritableContentStore } from "@imprint/content-core";
import type { AdminContext } from "@imprint/runtime-admin";

import { statusVan, taalActions } from "../src/actions";
import { audioKaart, audioSleutel, ontbrekend, opnamen, ssml, STEMMEN, zinKey, zinnen } from "../src/audio";
import { lesHref, pakketTaal, slugFromFile } from "../src/href";
import { TEKSTEN } from "../src/i18n";
import { importLes, parseLes } from "../src/import";
import { metVertaling, oefeningenVoor, perFase, tekstVoor } from "../src/lessen";
import { LesSchema, type Les } from "../src/schemas";
import { heeftVormen, lijktOp, norm, typGoed, vormen, vormenKloppen, woorden, zegGoed } from "../src/tekst";
import { kentVormen } from "../src/i18n";
import { beste, isScore, leesVoortgang, samenvoegen, type Stand } from "../src/stand";
import { azureTts, type Synthesize } from "../src/tts";

// One real lesson file; the site's own test parses all of them (sites/taal/test).
const FILE = "01-dit-en-dat.md";
const les1 = parseLes(FILE, readFileSync(path.join(import.meta.dirname, "fixtures", FILE), "utf8"));
/** Four more lessons with sentences of their own. */
const lessen: Les[] = [
  les1,
  ...[2, 3, 4, 5].map((n) => ({ ...les1, id: `nl-0-0${n}`, slug: `les-${n}`, dialoog: [{ nl: `Zin ${n}.`, pl: `Zdanie ${n}.` }], brokken: [`brok ${n}`], audio: {} })),
];

/** The stores and the session an action needs, in memory. */
function fakeAdmin(start: Les[], session: { name: string } | null = { name: "redacteur" }) {
  const items = new Map(start.map((l) => [l.id, l as unknown]));
  const puts: { slug: string; by?: string }[] = [];
  const files = new Map<string, Uint8Array>();
  const record = (slug: string, data: unknown) => ({ slug, data }) as ContentRecord;
  const store = {
    listItems: async () => [...items].map(([slug, data]) => record(slug, data)),
    getItem: async (_type: string, slug: string) => (items.has(slug) ? record(slug, items.get(slug)) : null),
    putItem: async (_type: string, slug: string, data: unknown, opts?: { by?: string }) => {
      items.set(slug, LesSchema.parse(data));
      puts.push({ slug, by: opts?.by });
    },
  } as unknown as WritableContentStore;
  const admin = {
    auth: { editingSession: async () => session },
    imprint: {
      writableStore: store,
      assets: {
        put: async (p: string, bytes: Uint8Array) => {
          files.set(p, bytes);
          return `/api/assets/${p}`;
        },
      },
    },
  } as unknown as AdminContext;
  return { admin, store, puts, files, les: (id: string) => items.get(id) as Les };
}

function fakeTts() {
  const calls: string[] = [];
  const synthesize: Synthesize = async (text, stem, tempo) => {
    calls.push(`${stem.voice}|${tempo}|${text}`);
    return new TextEncoder().encode(`${tempo}:${text}`);
  };
  return { calls, synthesize };
}

describe("a lesson file", () => {
  it("parses against the schema, with the file name as slug and the body as assignment", () => {
    assert.equal(les1.id, "nl-0-01");
    assert.equal(les1.slug, "dit-en-dat");
    assert.equal(les1.taal, "nl");
    assert.equal(les1.steuntaal, "pl");
    assert.equal(les1.dialoog[0]!.pl, "Dzień dobry. Co to jest?");
    assert.match(les1.ombouwen, /^\*\*Ombouwen:\*\*/);
    assert.deepEqual(les1.audio, {});
    assert.deepEqual(les1.oefeningen.map((o) => o.type), ["luister", "kies", "typ", "orden", "zeg"]);
  });

  it("is refused when an answer points past the options", () => {
    const bad = { ...les1, oefeningen: [{ type: "kies", vraag: "?", opties: ["a", "b"], antwoord: 2 }] };
    assert.equal(LesSchema.safeParse(bad).success, false);
  });
});

describe("addresses", () => {
  it("name a lesson by interface language, package and slug", () => {
    assert.equal(lesHref("pl", les1), "/pl/nederlands/dit-en-dat");
    assert.equal(lesHref("nl", { id: "pl-0-01", taal: "pl" }), "/nl/polski/pl-0-01");
    assert.equal(pakketTaal("nederlands"), "nl");
    assert.equal(pakketTaal("klingon"), null);
    assert.equal(slugFromFile("lessen/nl/fase-0/03-misschien-te-genoeg.md"), "misschien-te-genoeg");
  });

  it("group lessons per phase", () => {
    const fasen = perFase([...lessen, { ...les1, id: "nl-1-01", fase: 1 }]);
    assert.deepEqual(fasen.map((f) => [f.fase, f.lessen.length]), [[0, 5], [1, 1]]);
  });
});

describe("comparing answers", () => {
  it("ignores case, punctuation, diacritics and extra spaces", () => {
    assert.equal(norm("  Hoeveel   kost HET?! "), "hoeveel kost het");
    assert.equal(norm("Dzień dobry."), norm("dzien dobry"));
    assert.ok(typGoed("hoeveel is dit", ["Hoeveel is dit?", "Hoeveel kost dit?"]));
    assert.ok(!typGoed("hoeveel is dat", ["Hoeveel is dit?"]));
  });

  it("lets small recognition mistakes pass, not other sentences", () => {
    assert.ok(lijktOp("kan ik pinne", "Kan ik pinnen?"));
    assert.ok(!lijktOp("kan ik betalen", "Kan ik pinnen?"));
    assert.ok(zegGoed(["wat is dik", "wat is dit"], ["Wat is dit?", "Wat is dat?"]));
    assert.ok(!zegGoed(["hoeveel is dit"], ["Wat is dit?", "Wat is dat?"]));
  });

  it("splits a sentence into words", () => {
    assert.deepEqual(woorden("Wat  is dit?"), ["Wat", "is", "dit?"]);
  });
});

describe("forms per learner", () => {
  it("shows the chosen form, and both without a choice", () => {
    assert.equal(vormen("Pracował{em|am} cały dzień.", "m"), "Pracowałem cały dzień.");
    assert.equal(vormen("Pracował{em|am} cały dzień.", "v"), "Pracowałam cały dzień.");
    assert.equal(vormen("Pracował{em|am} cały dzień."), "Pracowałem/am cały dzień.");
    assert.equal(vormen("Robię to sam{|a}.", "m"), "Robię to sam.");
    assert.equal(vormen("Siedzisz z {żoną|mężem}.", "v"), "Siedzisz z mężem.");
    assert.equal(vormen("Co to jest?", "v"), "Co to jest?");
  });

  it("knows a text with forms, and a form that is written wrong", () => {
    assert.ok(heeftVormen("Był{em|am}"));
    assert.ok(!heeftVormen("Byłem"));
    assert.ok(vormenKloppen("Był{em|am} tu, chor{y|a}."));
    assert.ok(!vormenKloppen("Był{em/am}"));
    assert.ok(!vormenKloppen("Był{em|am|o}"));
  });

  it("offers the choice in Polish only", () => {
    assert.ok(kentVormen("pl"));
    assert.ok(!kentVormen("nl"));
  });
});

describe("which exercises fit the interface language", () => {
  it("shows all of them and the translations in the support language", () => {
    assert.ok(metVertaling(les1, "pl"));
    assert.equal(oefeningenVoor(les1, "pl").length, les1.oefeningen.length);
  });

  it("keeps only kies and orden without the support language", () => {
    assert.ok(!metVertaling(les1, "nl"));
    assert.deepEqual(oefeningenVoor(les1, "nl").map((o) => o.type), ["kies", "orden"]);
  });

  it("shows a per-language text only in the language of the interface", () => {
    const patroon = { pl: "Zauważ…", nl: "Let op…" };
    assert.equal(tekstVoor(patroon, "pl"), "Zauważ…");
    assert.equal(tekstVoor(patroon, "nl"), "Let op…");
    assert.equal(tekstVoor(patroon, "de"), "");
    assert.deepEqual(les1.situatie, {}, "phase 0 has none");
  });

  it("has every text in both interface languages", () => {
    assert.deepEqual(Object.keys(TEKSTEN.pl!).sort(), Object.keys(TEKSTEN.nl!).sort());
    for (const [k, v] of Object.entries(TEKSTEN.pl!)) assert.ok(typeof v === "object" || v.length > 0, k);
  });
});

describe("recordings", () => {
  it("collects each playable sentence once, in the language taught only", () => {
    const z = zinnen(les1);
    assert.ok(z.every((x) => x.lang === "nl"));
    assert.equal(new Set(z.map((x) => x.text)).size, z.length);
    const texts = z.map((x) => x.text);
    for (const t of ["Goedemiddag. Wat is dit?", "alstublieft", "Dat is een peer.", "Hoeveel is dit?", "Wat is dit?"]) assert.ok(texts.includes(t), t);
    assert.ok(!texts.includes("Co to jest?"));
  });

  it("keys a recording like the prototype: sha1 of voice, rate and text", () => {
    const expect = createHash("sha1").update("nl-NL-FennaNeural|-30%|Wat is dit?").digest("hex").slice(0, 16);
    assert.equal(audioSleutel("nl-NL-FennaNeural", "slow", "Wat is dit?"), expect);
    assert.notEqual(audioSleutel("nl-NL-FennaNeural", "normal", "Wat is dit?"), expect);
  });

  it("needs two recordings per sentence, minus what the lesson or another lesson has", () => {
    const all = opnamen(les1);
    assert.equal(all.length, zinnen(les1).length * 2);
    const [a, b] = all;
    const les = { ...les1, audio: { [a!.sleutel]: "/x.mp3" } };
    assert.equal(ontbrekend(les).length, all.length - 1);
    assert.equal(ontbrekend(les, { [b!.sleutel]: "/y.mp3" }).length, all.length - 2);
    assert.deepEqual(audioKaart(les)[zinKey(a!.lang, a!.text)], { [a!.tempo]: "/x.mp3" });
  });

  it("skips a language without a voice", () => {
    assert.equal(opnamen({ ...les1, taal: "xx" }).length, 0);
  });

  it("escapes the sentence in SSML", () => {
    const xml = ssml(`Wat betekent "A & B"?`, STEMMEN.nl!, "slow");
    assert.match(xml, /<prosody rate="-30%">Wat betekent &quot;A &amp; B&quot;\?<\/prosody>/);
    assert.match(xml, /<voice name="nl-NL-FennaNeural">/);
  });
});

describe("the action genereerAudio", () => {
  it("asks only for what is missing, stores it, and asks nothing the second time", async () => {
    const { admin, puts, files, les } = fakeAdmin([les1]);
    const tts = fakeTts();
    const { genereerAudio } = taalActions({ synthesize: tts.synthesize, pauze: 0 });
    const need = opnamen(les1).length;

    const first = await genereerAudio(admin, les1.id);
    assert.deepEqual(first, { ok: true, gemaakt: need, hergebruikt: 0 });
    assert.equal(tts.calls.length, need);
    assert.equal(files.size, need);
    assert.equal(Object.keys(les(les1.id).audio).length, need);
    assert.ok(Object.values(les(les1.id).audio).every((u) => /^\/api\/assets\/taal\/tts\/[0-9a-f]{16}\.mp3$/.test(u)));
    assert.deepEqual(puts, [{ slug: les1.id, by: "redacteur" }]);

    const second = await genereerAudio(admin, les1.id);
    assert.deepEqual(second, { ok: true, gemaakt: 0, hergebruikt: 0 });
    assert.equal(tts.calls.length, need, "no new requests");
    assert.equal(puts.length, 1, "no new version");
  });

  it("asks only for the changed sentence after an edit", async () => {
    const { admin, store } = fakeAdmin([les1]);
    const tts = fakeTts();
    const { genereerAudio } = taalActions({ synthesize: tts.synthesize, pauze: 0 });
    await genereerAudio(admin, les1.id);
    const before = tts.calls.length;
    const current = LesSchema.parse((await store.getItem("les", les1.id))!.data);
    await store.putItem("les", les1.id, { ...current, brokken: [...current.brokken, "tot ziens"] });
    assert.deepEqual(await genereerAudio(admin, les1.id), { ok: true, gemaakt: 2, hergebruikt: 0 });
    assert.deepEqual(tts.calls.slice(before), ["nl-NL-FennaNeural|normal|tot ziens", "nl-NL-FennaNeural|slow|tot ziens"]);
  });

  it("takes over a sentence another lesson already has", async () => {
    const shared = opnamen(les1).filter((o) => o.text === "Hoeveel is dit?");
    const other = { ...lessen[3]!, audio: Object.fromEntries(shared.map((o) => [o.sleutel, `/api/assets/${o.sleutel}.mp3`])) };
    const { admin, les } = fakeAdmin([les1, other]);
    const tts = fakeTts();
    assert.equal(statusVan(les1, [les1, other]).hergebruik, 2);
    const result = await taalActions({ synthesize: tts.synthesize, pauze: 0 }).genereerAudio(admin, les1.id);
    assert.deepEqual(result, { ok: true, gemaakt: opnamen(les1).length - 2, hergebruikt: 2 });
    assert.ok(!tts.calls.some((c) => c.endsWith("|Hoeveel is dit?")));
    assert.equal(les(les1.id).audio[shared[0]!.sleutel], `/api/assets/${shared[0]!.sleutel}.mp3`);
  });

  it("says so without a key, and still takes over what exists", async () => {
    const shared = opnamen(les1).slice(0, 2);
    const other = { ...lessen[1]!, audio: Object.fromEntries(shared.map((o) => [o.sleutel, "/a.mp3"])) };
    const { admin, les } = fakeAdmin([les1, other]);
    const result = await taalActions({ synthesize: null }).genereerAudio(admin, les1.id);
    assert.equal(result.ok, false);
    assert.match(result.error!, /AZURE_TTS_KEY/);
    assert.equal(result.hergebruikt, 2);
    assert.equal(Object.keys(les(les1.id).audio).length, 2);
  });

  it("keeps what was made when the service fails halfway", async () => {
    const { admin, les } = fakeAdmin([les1]);
    let n = 0;
    const synthesize: Synthesize = async () => {
      if (++n > 3) throw new Error("Azure TTS 429");
      return new Uint8Array([1]);
    };
    const result = await taalActions({ synthesize, pauze: 0 }).genereerAudio(admin, les1.id);
    assert.deepEqual(result, { ok: false, error: "Azure TTS 429", gemaakt: 3, hergebruikt: 0 });
    assert.equal(Object.keys(les(les1.id).audio).length, 3);
  });

  it("refuses without a session, and an unknown lesson", async () => {
    const tts = fakeTts();
    const actions = taalActions({ synthesize: tts.synthesize, pauze: 0 });
    assert.equal((await actions.genereerAudio(fakeAdmin([les1], null).admin, les1.id)).ok, false);
    assert.equal(await actions.audioStatus(fakeAdmin([les1], null).admin), null);
    assert.equal((await actions.genereerAudio(fakeAdmin([les1]).admin, "nope")).ok, false);
    assert.equal(tts.calls.length, 0);
  });

  it("reports per lesson what a run would ask for", async () => {
    const { admin } = fakeAdmin(lessen);
    const overzicht = await taalActions({ synthesize: null }).audioStatus(admin);
    assert.equal(overzicht!.kan, false);
    assert.equal(overzicht!.lessen.length, 5);
    const eerste = overzicht!.lessen[0]!;
    assert.equal(eerste.ontbreekt + eerste.hergebruik, eerste.zinnen * 2);
    assert.ok(eerste.tekens > 0);
  });
});

describe("where a learner stands", () => {
  const s = (score: number, total = 5, datum = "2026-11-13") => ({ score, total, datum });

  it("keeps the better result, and of two equal ones the later", () => {
    assert.deepEqual(beste(s(3), s(4)), s(4));
    assert.deepEqual(beste(s(4), s(3)), s(4));
    assert.deepEqual(beste(s(4, 5), s(6, 8)), s(4, 5), "the share right, not the count");
    assert.deepEqual(beste(s(4, 5, "2026-11-01"), s(4, 5, "2026-11-13")), s(4, 5, "2026-11-13"));
    assert.deepEqual(beste(undefined, s(1)), s(1));
  });

  it("knows a result from anything else", () => {
    assert.ok(isScore(s(0)));
    assert.ok(isScore({ score: 2, total: 5 }));
    for (const x of [null, "5", { score: 6, total: 5 }, { score: -1, total: 5 }, { score: 1, total: 0 }, { score: 1.5, total: 5 }, { score: 1, total: 5, datum: "gisteren" }]) assert.ok(!isScore(x), JSON.stringify(x));
    assert.deepEqual(leesVoortgang('{"a":{"score":1,"total":2},"b":"x"}'), { a: { score: 1, total: 2 } });
    assert.deepEqual(leesVoortgang("geen json"), {});
    assert.deepEqual(leesVoortgang(null), {});
  });

  it("makes browser and account equal: the best of each lesson, and what the account lacks", () => {
    const { samen, naarServer } = samenvoegen({ a: s(5), b: s(2), c: s(3) }, { b: s(4), c: s(3), d: s(1) });
    assert.deepEqual(samen, { a: s(5), b: s(4), c: s(3), d: s(1) });
    assert.deepEqual(Object.keys(naarServer), ["a"]);
  });
});

describe("the member's actions: stand, bewaar, zetVorm", () => {
  function metLid(naam: string | null) {
    const waarden = new Map<string, unknown>();
    const { admin } = fakeAdmin([les1]);
    const a = admin as unknown as { auth: Record<string, unknown>; imprint: Record<string, unknown> };
    a.auth.getSession = async () => (naam ? { name: naam, role: "reader" } : null);
    a.imprint.users = {
      memberValues: async (wie: string, scope: string) =>
        Object.fromEntries([...waarden].filter(([k]) => k.startsWith(`${wie}|${scope}|`)).map(([k, v]) => [k.split("|")[2], v])),
      setMemberValue: async (wie: string, scope: string, key: string, value: unknown) => {
        if (value === null) waarden.delete(`${wie}|${scope}|${key}`);
        else waarden.set(`${wie}|${scope}|${key}`, value);
      },
    };
    return { admin, waarden, ...taalActions({ synthesize: null }) };
  }

  it("answers 'not signed in' without a session, and keeps nothing", async () => {
    const { admin, waarden, stand, bewaar, zetVorm } = metLid(null);
    assert.deepEqual(await stand(admin), { ingelogd: false });
    assert.equal((await bewaar(admin, { [les1.id]: { score: 5, total: 5 } })).ok, false);
    assert.equal((await zetVorm(admin, "v")).ok, false);
    assert.equal(waarden.size, 0);
  });

  it("keeps a member's results: only of lessons that exist, only real results, only when better", async () => {
    const { admin, waarden, stand, bewaar } = metLid("ewa");
    assert.deepEqual(await stand(admin), { ingelogd: true, naam: "ewa", voortgang: {}, vorm: null });
    await bewaar(admin, { [les1.id]: { score: 3, total: 5, datum: "2026-11-12" }, "nl-9-99": { score: 5, total: 5 }, x: "y" });
    await bewaar(admin, { [les1.id]: { score: 2, total: 5, datum: "2026-11-13" } });
    await bewaar(admin, { [les1.id]: { score: 9, total: 5 } });
    assert.equal((await bewaar(admin, "kapot")).ok, false);
    assert.deepEqual([...waarden.keys()], [`ewa|taal|les:${les1.id}`]);
    const s = (await stand(admin)) as Extract<Stand, { ingelogd: true }>;
    assert.deepEqual(s.voortgang, { [les1.id]: { score: 3, total: 5, datum: "2026-11-12" } });
    await bewaar(admin, { [les1.id]: { score: 5, total: 5, datum: "2026-11-13", extra: "weg" } });
    assert.deepEqual(waarden.get(`ewa|taal|les:${les1.id}`), { score: 5, total: 5, datum: "2026-11-13" });
  });

  it("keeps the choice of forms, and forgets it for anything else", async () => {
    const { admin, stand, zetVorm } = metLid("ewa");
    await zetVorm(admin, "v");
    assert.equal(((await stand(admin)) as { vorm: unknown }).vorm, "v");
    await zetVorm(admin, "x");
    assert.equal(((await stand(admin)) as { vorm: unknown }).vorm, null);
  });
});

describe("the import", () => {
  it("writes a new lesson, skips an unchanged one, and keeps the recordings on a change", async () => {
    const { store, puts, les } = fakeAdmin([]);
    assert.equal(await importLes(store, les1), "new");
    assert.equal(await importLes(store, les1), "same");
    await store.putItem("les", les1.id, { ...les1, audio: { abc: "/a.mp3" } });
    assert.equal(await importLes(store, les1), "same", "recordings are no change");
    assert.equal(await importLes(store, { ...les1, titel: "Dit en dat" }), "changed");
    assert.deepEqual(les(les1.id).audio, { abc: "/a.mp3" });
    assert.equal(puts.length, 3);
  });
});

describe("Azure text-to-speech", () => {
  it("is absent without a key", () => {
    assert.equal(azureTts({}), null);
    assert.equal(azureTts({ key: "" }), null);
  });

  it("posts SSML to the region's endpoint and returns the bytes", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetcher = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(new Uint8Array([1, 2, 3]));
    }) as unknown as typeof fetch;
    const bytes = await azureTts({ key: "k", region: "northeurope" }, fetcher)!("Wat is dit?", STEMMEN.nl!, "normal");
    assert.deepEqual([...bytes], [1, 2, 3]);
    assert.equal(seen!.url, "https://northeurope.tts.speech.microsoft.com/cognitiveservices/v1");
    const headers = seen!.init.headers as Record<string, string>;
    assert.equal(headers["Ocp-Apim-Subscription-Key"], "k");
    assert.match(String(seen!.init.body), /<prosody rate="0%">Wat is dit\?<\/prosody>/);
  });

  it("throws with the status when the service refuses", async () => {
    const fetcher = (async () => new Response("quota", { status: 429 })) as unknown as typeof fetch;
    await assert.rejects(azureTts({ key: "k" }, fetcher)!("x", STEMMEN.nl!, "slow"), /Azure TTS 429/);
  });
});
