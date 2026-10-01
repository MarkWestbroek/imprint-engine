import { definePlugin, type ImprintPlugin, type PluginAction, type WidgetViewers } from "@imprint/runtime-admin";
import { eventsActions } from "./actions";
import { eventsContentTypes } from "./content-types";
import { eventsPublicRoute } from "./public";
import { EventsConfig, EventsWidget } from "./widget";

/**
 * @imprint/plugin-events — the agenda as a plugin (design/communities.md
 * §4.5, step a): the content type `event` (when, where, links, organiser,
 * optionally a group), the `events` widget (the next events of the site, a
 * group or a tag), the agenda `/events` and a page per event under
 * `/events/<slug>`. Step b: signing up (komt / misschien / komt niet) for
 * members through the site's dispatcher (`AttendButton` on the prerendered
 * event page), and `EventAttendeesScreen` for the organiser, mounted by the
 * site at `/events/<slug>/attendees`. A site switches it on with `plugins: [eventsPlugin()]`
 * and composes the widget into its catalogue (`eventsWidgets` / `eventsViewers`).
 *
 * Node scripts import the React-free entries: `./content-types`, `./schemas`, `./href`.
 */

export const eventsWidgets = [
  {
    name: "events",
    label: "Agenda",
    version: "1.0.0",
    help: "The next events: of the whole site, one group or one tag (or what is over); with a link to the agenda.",
    configSchema: EventsConfig,
  },
] as const;

export const eventsViewers: WidgetViewers = { events: EventsWidget as WidgetViewers[string] };

export function eventsPlugin(): ImprintPlugin {
  return definePlugin({
    name: "events",
    version: "0.11.0",
    contentTypes: eventsContentTypes,
    widgets: [...eventsWidgets],
    menu: [{ group: "content", section: "Agenda", items: [{ href: "/admin/event", label: "Events" }] }],
    actions: eventsActions as unknown as Record<string, PluginAction>,
    publicRoute: eventsPublicRoute,
  });
}

export { eventsContentTypes } from "./content-types";
export { EVENTS_PREFIX, eventHref, eventSlug, eventSummary, eventsHref, formatDay, formatMonth, formatTime, formatWhen, isPast } from "./href";
export { EventSchema, type Event } from "./schemas";
export { EventsConfig, type EventsConfig as EventsWidgetConfig } from "./widget";
export { getEvent, listEvents } from "./events";
export { EventList } from "./event-list";
export { eventsActions, type AttendStatus, type Attendee } from "./actions";
export { EventAttendeesScreen } from "./attendees";
