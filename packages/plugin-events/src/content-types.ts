import { itemsOf, plain, type ContentTypeDefinition } from "@imprint/content-core";
import { eventHref } from "./href";
import { EventSchema, type Event } from "./schemas";

/** The plugin's content type: events, edited with the generic form in the admin. */
export const eventsContentTypes: ContentTypeDefinition[] = [
  {
    name: "event",
    schema: EventSchema,
    label: "Events",
    flags: ["listable", "editable"],
    domain: "events",
    relations: [{ fromType: "event", field: "group", toType: "group", enforce: true, label: "Event → group" }],
    search: {
      kinds: { event: { label: "evenement", prefixes: ["agenda", "evenement", "evenementen", "event", "events"] } },
      docs: async (store) =>
        (await itemsOf<Event>(store, "event")).map((e) => ({
          kind: "event",
          href: eventHref(e.slug),
          title: e.title,
          summary: plain(`${e.start.slice(0, 10)}${e.location ? ` · ${e.location}` : ""} · ${e.summary || e.body}`),
          text: `${e.summary} ${e.body} ${e.location} ${e.address} ${e.organizer} ${(e.tags ?? []).join(" ")}`,
        })),
    },
    emptyData: () => ({
      slug: "",
      lang: "en",
      access: "public",
      title: "",
      summary: "",
      body: "",
      start: new Date().toISOString().slice(0, 16) + "+01:00",
      end: "",
      location: "",
      address: "",
      locationLink: "",
      externalLink: "",
      ticketLink: "",
      online: false,
      organizer: "",
      rsvp: false,
      repeat: "",
      tags: [],
      group: "",
    }),
  },
];
