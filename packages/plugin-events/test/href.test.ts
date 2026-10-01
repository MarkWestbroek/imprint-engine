import assert from "node:assert/strict";
import { test } from "node:test";
import { eventHref, eventSlug, formatDay, formatTime, formatWhen, isPast } from "../src/href";
import { EventSchema } from "../src/schemas";

test("eventSlug and eventHref", () => {
  assert.equal(eventSlug("Fieldlab Common Ground – juni"), "fieldlab-common-ground-juni");
  assert.equal(eventHref("x"), "/events/x");
});

test("dates render in Dutch, in Amsterdam time, whatever the offset given", () => {
  assert.equal(formatDay("2026-11-30T15:00:00+01:00"), "maandag 30 november 2026");
  assert.equal(formatTime("2026-11-30T14:00:00Z"), "15:00");
  assert.equal(formatWhen("2026-11-30T15:00:00+01:00", "2026-11-30T16:00:00+01:00"), "maandag 30 november 2026, 15:00–16:00");
  assert.equal(
    formatWhen("2026-11-30T15:00:00+01:00", "2026-12-01T12:00:00+01:00"),
    "maandag 30 november 2026, 15:00 – dinsdag 1 december 2026, 12:00"
  );
});

test("isPast: judged on the end, else the start", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  assert.equal(isPast({ start: "2026-10-01T10:00:00Z", end: "2026-10-01T13:00:00Z" }, now), false);
  assert.equal(isPast({ start: "2026-10-01T10:00:00Z", end: "" }, now), true);
  assert.equal(isPast({ start: "2026-10-02T10:00:00Z", end: "" }, now), false);
});

test("EventSchema: a start is required and must be ISO; the rest has defaults", () => {
  const e = EventSchema.parse({ slug: "a", title: "A", start: "2026-11-30T15:00+01:00" });
  assert.deepEqual([e.end, e.online, e.rsvp, e.group, e.tags], ["", false, false, "", []]);
  assert.equal(EventSchema.safeParse({ slug: "a", title: "A", start: "30 nov" }).success, false);
});
