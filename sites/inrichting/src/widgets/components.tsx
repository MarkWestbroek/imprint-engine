import Link from "next/link";
import type { WidgetViewers } from "@imprint/runtime-admin";
import { standardViewers } from "@imprint/widgets-standard/viewers";
import { omniumViewers } from "@imprint/plugin-omnium";

/** Widget type name → viewer, for every widget in ./registry.ts. */
export const widgetComponents: WidgetViewers = {
  ...omniumViewers,
  hero: standardViewers.hero,
  text: standardViewers.text,
  callout: standardViewers.callout,
  table: standardViewers.table,
  accordion: standardViewers.accordion,
  tabs: standardViewers.tabs,
  cards: standardViewers.cards,
  buttons: standardViewers.buttons,
  divider: standardViewers.divider,
  toc: standardViewers.toc,
  breadcrumb: standardViewers.breadcrumb,
  code: standardViewers.code,
  mermaid: standardViewers.mermaid,
  v3model: standardViewers.v3model,
  image: standardViewers.image,
  embed: standardViewers.embed,
};

/** In place of a register widget on a public page: the register is only shown after signing in. */
function SignInFirst() {
  return (
    <p className="rounded-xl border border-line bg-surface p-5 text-sm text-muted">
      Deze gegevens komen uit het Omnium-register en zijn zichtbaar na <Link href="/admin" className="underline">inloggen</Link>.
    </p>
  );
}

/** The viewers for a visitor without a session: everything except the register widgets. */
export const publicWidgetComponents: WidgetViewers = Object.fromEntries(
  Object.entries(widgetComponents).map(([name, viewer]) => [name, name.startsWith("omnium-") ? SignInFirst : viewer])
);
