import type { WidgetViewers } from "@imprint/runtime-admin";
import { standardViewers } from "@imprint/widgets-standard/viewers";
import { Markdown } from "@imprint/runtime-admin";
import { contactAction } from "@/app/contact-action";
import { ContactForm } from "@/components/contact-form";
import { Patchbay, type PatchbayProps } from "@/components/patchbay";
import type { ContactTaal } from "@/lib/contact-teksten";

/** Widget type name → viewer, for every widget in ./registry.ts. */
export const widgetComponents: WidgetViewers = {
  hero: standardViewers.hero,
  text: standardViewers.text,
  table: standardViewers.table,
  accordion: standardViewers.accordion,
  callout: standardViewers.callout,
  image: standardViewers.image,
  gallery: standardViewers.gallery,
  carousel: standardViewers.carousel,
  album: standardViewers.album,
  video: standardViewers.video,
  audio: standardViewers.audio,
  divider: standardViewers.divider,
  quote: standardViewers.quote,
  tabs: standardViewers.tabs,
  cards: standardViewers.cards,
  buttons: standardViewers.buttons,
  toc: standardViewers.toc,
  breadcrumb: standardViewers.breadcrumb,
  file: standardViewers.file,
  pdf: standardViewers.pdf,
  timeline: standardViewers.timeline,
  mediatext: standardViewers.mediatext,
  people: standardViewers.people,
  embed: standardViewers.embed,
  patchbay: ({ config }) => <Patchbay {...(config as PatchbayProps)} />,
  contact: ({ config, ctx }) => {
    const { title, intro, anker, taal } = config as { title: string; intro?: string; anker: string; taal: ContactTaal };
    return (
      <section id={anker} lang={taal} className="scroll-mt-6 rounded-xl border border-line bg-surface p-5">
        <h2>{title}</h2>
        {intro ? (
          <div className="markdown mt-3">
            <Markdown>{intro}</Markdown>
          </div>
        ) : null}
        <div className="mt-5 max-w-xl">
          <ContactForm action={contactAction} page={`/${ctx.page?.slug ?? ""}`} taal={taal} />
        </div>
      </section>
    );
  },
};
