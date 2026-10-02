import { z } from "zod";
import { Access, Locale, assetSrc } from "@imprint/content-core";

/**
 * An event in the agenda (design/communities.md §4.5, step a): when, where,
 * what, and the links around it. Signing up (komt / misschien / komt niet)
 * is step b and personal data: it will live next to memberships, not here.
 * `rsvp` and `maxAttendees` are kept from the source so that step has them.
 */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)?$/;

export const EventSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  lang: Locale.default("en"),
  access: Access.default("public"),
  title: z.string().min(1),
  summary: z.string().default(""),
  body: z.string().default(""),
  /** Start, ISO 8601 with offset (e.g. 2026-11-30T15:00+01:00). */
  start: z.string().regex(ISO_DATETIME),
  /** End, same form; empty = no end given. */
  end: z.string().regex(ISO_DATETIME).or(z.literal("")).default(""),
  /** Place as written ("Utrecht, Jaarbeurs", "Teams"). */
  location: z.string().default(""),
  address: z.string().default(""),
  /** A map or venue link. */
  locationLink: z.string().default(""),
  /** The event's own page elsewhere (the organiser's site). */
  externalLink: z.string().default(""),
  ticketLink: z.string().default(""),
  /** Online attendance is possible (a video call, a stream). */
  online: z.boolean().default(false),
  /** Display name of the organiser. */
  organizer: z.string().default(""),
  /** The account that made it, when a member did (set by the engine; the policy's "own work"). */
  author: z.string().default(""),
  /** Sign-up asked for (step b); informational until then. */
  rsvp: z.boolean().default(false),
  maxAttendees: z.number().int().positive().optional(),
  /** A repeat rule as text ("elke 2 weken op maandag, t/m 1 december 2026"); the occurrences are not expanded. */
  repeat: z.string().default(""),
  tags: z.array(z.string()).default([]),
  /** Slug of the group this event belongs to; empty = the site itself. */
  group: z.string().default(""),
  /** A library asset (`asset:<slug>`), a URL, or a path under public/. */
  image: assetSrc().optional(),
});
export type Event = z.infer<typeof EventSchema>;
