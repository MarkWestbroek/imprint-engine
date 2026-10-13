import assert from "node:assert/strict";
import { test } from "node:test";
import { convertSlide } from "../src/import";
import { notesOf, sanitizeSlide } from "../src/sanitize";

test("the notes leave the slide and come back as plain text", () => {
  const raw = '<section id="a" style="background:#fff"><h2 style="font-size:72px">Titel</h2><aside>Zeg &amp; wijs.</aside></section>';
  const { html, notes } = convertSlide(raw, {});
  assert.equal(notes, "Zeg & wijs.");
  assert.doesNotMatch(html, /aside|Zeg/);
  assert.match(html, /<h2 style="font-size:72px">Titel<\/h2>/);
});

test("scripts, handlers, javascript: and data: URLs, and url() in styles are removed", () => {
  const dirty =
    '<section style="background:#fff"><script>alert(1)</script><p onclick="x()" style="color:red">Hi</p>' +
    '<a href="javascript:alert(1)">x</a><img src="data:image/png;base64,AAA" alt="d"><div style="background:url(evil)">y</div>' +
    '<iframe src="https://evil"></iframe><p class="k">ok</p></section>';
  const clean = sanitizeSlide(dirty);
  assert.doesNotMatch(clean, /script|onclick|javascript:|data:|url\(|iframe|class=/);
  assert.match(clean, /<p style="color:red">Hi<\/p>/);
  assert.match(clean, /<a rel="noopener noreferrer">x<\/a>/);
  assert.match(clean, /<p>ok<\/p>/);
});

test("icons become inline SVG, shapes SVG or boxes, blobs the site's own paths", () => {
  const raw =
    '<section><x-icon name="Database" style="color:#6366f1;width:48px;height:48px"></x-icon>' +
    '<x-shape kind="arrow-right" style="width:64px;height:36px;background:#94a3b8"></x-shape>' +
    '<x-shape kind="ellipse" style="width:24px;height:24px;background:#0891b2"></x-shape>' +
    '<img src="/_blob/abc123" alt="merk" style="width:72px"></section>';
  const { html } = convertSlide(raw, { abc123: "/brand/mark.svg" });
  assert.match(html, /<svg [^>]*aria-label="Database"/);
  assert.match(html, /stroke="#6366f1"/);
  assert.match(html, /<path d="M0 12h40V0l24 18-24 18V24H0z" fill="#94a3b8" \/>/);
  assert.match(html, /<div style="flex:none;border-radius:9999px;width:24px;height:24px;background:#0891b2"><\/div>/);
  assert.match(html, /<img src="\/brand\/mark.svg" alt="merk" style="width:72px">/);
  assert.doesNotMatch(html, /x-icon|x-shape|_blob/);
});

test("notesOf finds nothing when there is no aside", () => {
  assert.equal(notesOf("<section><p>x</p></section>"), "");
});
