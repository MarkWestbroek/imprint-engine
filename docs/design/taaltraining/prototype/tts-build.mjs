#!/usr/bin/env node
// Genereert MP3's voor alle lesregels via Azure TTS, tijdens de build.
// Alleen nieuwe of gewijzigde zinnen worden opnieuw aangevraagd (hash = cache-sleutel).
//
// Gebruik:
//   AZURE_TTS_KEY=... AZURE_TTS_REGION=westeurope node scripts/tts-build.mjs sites/taal
//
// Verwacht lessen als Markdown met frontmatter, bijvoorbeeld:
//   ---
//   taal: nl
//   steuntaal: pl
//   dialoog:
//     - nl: "Wat is dit?"
//       pl: "Co to jest?"
//   brokken: ["wat is dit?", "dit / dat"]
//   ---

import { readdir, readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import matter from "gray-matter";

const siteDir = process.argv[2] ?? "sites/taal";
const contentDir = path.join(siteDir, "content");
const audioDir = path.join(siteDir, "public", "audio");
const manifestPath = path.join(audioDir, "manifest.json");

const KEY = process.env.AZURE_TTS_KEY;
const REGION = process.env.AZURE_TTS_REGION ?? "westeurope";
if (!KEY) {
  console.error("AZURE_TTS_KEY ontbreekt");
  process.exit(1);
}

// Eén stem per taal. Wisselen = andere hash = nieuwe opnames.
const VOICES = {
  nl: { locale: "nl-NL", voice: "nl-NL-FennaNeural" },
  pl: { locale: "pl-PL", voice: "pl-PL-ZofiaNeural" },
  it: { locale: "it-IT", voice: "it-IT-ElsaNeural" },
  de: { locale: "de-DE", voice: "de-DE-KatjaNeural" },
};

// Twee tempo's: normaal en langzaam (voor "langzaam, alstublieft").
const RATES = { normal: "0%", slow: "-30%" };

const escapeXml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function ssml(text, lang, rate) {
  const { locale, voice } = VOICES[lang];
  return `<speak version="1.0" xml:lang="${locale}">` +
    `<voice name="${voice}"><prosody rate="${rate}">${escapeXml(text)}</prosody></voice>` +
    `</speak>`;
}

const hashOf = (text, lang, rate) =>
  createHash("sha1").update(`${VOICES[lang].voice}|${rate}|${text}`).digest("hex").slice(0, 16);

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function synthesize(text, lang, rate) {
  const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "imprint-tts",
    },
    body: ssml(text, lang, rate),
  });
  if (!res.ok) throw new Error(`TTS ${res.status} voor "${text}": ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

// Verzamel alle uit te spreken zinnen uit de lessen.
async function collectLines() {
  const files = (await readdir(contentDir, { recursive: true }))
    .filter((f) => f.endsWith(".md"));
  const lines = [];
  for (const f of files) {
    const { data } = matter(await readFile(path.join(contentDir, f), "utf8"));
    const lang = data.taal;
    const support = data.steuntaal;
    for (const regel of data.dialoog ?? []) {
      if (regel[lang]) lines.push({ text: regel[lang], lang });
      if (support && regel[support]) lines.push({ text: regel[support], lang: support });
    }
    for (const brok of data.brokken ?? []) lines.push({ text: brok, lang });
    for (const o of data.oefeningen ?? []) {
      if (o.type === "luister" && o.tekst) lines.push({ text: o.tekst, lang });
      if (o.type === "orden" && o.zin) lines.push({ text: o.zin, lang });
      if ((o.type === "zeg" || o.type === "typ") && o.antwoorden?.[0]) lines.push({ text: o.antwoorden[0], lang });
    }
  }
  return lines;
}

async function main() {
  await mkdir(audioDir, { recursive: true });
  const lines = await collectLines();

  // Manifest: taal -> tekst -> { normal, slow } bestandsnamen.
  const manifest = {};
  let made = 0, cached = 0;

  for (const { text, lang } of lines) {
    if (!VOICES[lang]) { console.warn(`Geen stem voor taal "${lang}", overgeslagen`); continue; }
    manifest[lang] ??= {};
    if (manifest[lang][text]) continue; // dubbele zin
    manifest[lang][text] = {};

    for (const [name, rate] of Object.entries(RATES)) {
      const file = `${hashOf(text, lang, rate)}.mp3`;
      manifest[lang][text][name] = file;
      const out = path.join(audioDir, file);
      if (await exists(out)) { cached++; continue; }
      await writeFile(out, await synthesize(text, lang, rate));
      made++;
      await new Promise((r) => setTimeout(r, 150)); // rustig aan met de API
    }
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`TTS klaar: ${made} nieuw, ${cached} uit cache, manifest in ${manifestPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
