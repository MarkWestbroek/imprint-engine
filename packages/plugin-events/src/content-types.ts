import type { ContentTypeDefinition } from "@imprint/content-core";
import { EventSchema } from "./schemas";

/** The plugin's content type: events, edited with the generic form in the admin. */
export const eventsContentTypes: ContentTypeDefinition[] = [
  {
    name: "event",
    schema: EventSchema,
    label: "Events",
    flags: ["listable", "editable"],
    domain: "events",
    relations: [{ fromType: "event", field: "group", toType: "group", enforce: true, label: "Event → group" }],
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
