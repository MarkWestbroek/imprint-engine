import assert from "node:assert/strict";
import { test } from "node:test";
import { annotationText, toWebAnnotation } from "@imprint/content-core";
import { AnnotationSchema } from "../src/schemas";

test("an annotation needs a target and an author; bodies and selectors default to none", () => {
  const a = AnnotationSchema.parse({ slug: "anno-1", author: "ann", created: "2026-10-01T10:00:00Z", target: [{ source: { type: "post", slug: "p" } }] });
  assert.deepEqual([a.motivation, a.body, a.hidden, a.target[0]!.selector, a.target[0]!.field], ["commenting", [], false, [], ""]);
  assert.equal(AnnotationSchema.safeParse({ slug: "x", author: "ann", created: "t", target: [] }).success, false, "at least one target");
});

test("bodies: text and resources, in one list; selectors and state as the W3C model names them", () => {
  const a = AnnotationSchema.parse({
    slug: "anno-2",
    author: "ann",
    created: "2026-10-01T10:00:00Z",
    motivation: "highlighting",
    target: [
      {
        source: { type: "post", slug: "p" },
        field: "body",
        selector: [{ type: "TextQuoteSelector", exact: "de interne notities", prefix: "Atlas: " }, { type: "TextPositionSelector", start: 28, end: 47 }],
        state: { type: "TimeState", sourceDate: "2026-10-01T09:00:00Z" },
      },
    ],
    body: [{ type: "TextualBody", value: "Klopt dit nog?" }, { type: "Resource", source: "asset:schets-1" }],
  });
  assert.equal(annotationText(a.body), "Klopt dit nog?");
  assert.equal(a.target[0]!.selector.length, 2);
  const w3c = toWebAnnotation({ id: "https://x/anno/anno-2", ...a, targetUrl: (t) => `https://x/${t.source.type}/${t.source.slug}`, bodyUrl: (s) => `https://x/api/assets/_ref/${s.slice(6)}` });
  assert.equal(w3c["@context"], "http://www.w3.org/ns/anno.jsonld");
  assert.deepEqual(w3c.target[0]!.state, { type: "TimeState", sourceDate: "2026-10-01T09:00:00Z" });
  assert.equal((w3c.body[1] as { id: string }).id, "https://x/api/assets/_ref/schets-1");
});
