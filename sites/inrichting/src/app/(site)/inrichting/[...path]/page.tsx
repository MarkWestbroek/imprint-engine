import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { omniumPage } from "@imprint/plugin-omnium/page";
import { widgetContext } from "@/lib/widget-context";
import { widgetComponents } from "@/widgets/components";
import { auth } from "@/lib/admin";
import { slaWerkplaatsOp } from "../werkplaats-actions";

/**
 * A record of the Omnium register by its stable key (design/omnium-inrichting.md
 * §3.4), rendered with the studio template `_view/omnium-<pad>` or the
 * plugin's built-in view. `?peiltijdstip=` (RFC 3339) and `?geldigOp=` (a
 * date) show the register as it was; on a drawing, `?element=` lights up one
 * element (a form field links there from its traceregel). Under a version,
 * `/werkplaats/<stap>` is its werkplaats; `?vraag=` selects a question there.
 */

type Props = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ peiltijdstip?: string; geldigOp?: string; element?: string; veld?: string; vraag?: string; bewerk?: string }>;
};

async function load({ params, searchParams }: Props) {
  const [{ path }, q] = await Promise.all([params, searchParams]);
  return omniumPage({
    path,
    viewers: widgetComponents,
    ctx: await widgetContext(),
    peiltijdstip: q.peiltijdstip,
    geldigOp: q.geldigOp,
    element: q.element,
    veld: q.veld,
    vraag: q.vraag,
    bewerk: q.bewerk === "1",
    // Saving from the werkplaats only for who may edit; a reader keeps the try-out.
    werkplaatsOpslaan: q.bewerk === "1" && (await auth.editingSession()) ? slaWerkplaatsOp : undefined,
  });
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const page = await load(props);
  return page ? { title: page.title } : {};
}

export default async function RegisterRecord(props: Props) {
  const page = await load(props);
  if (!page) notFound();
  return page.render;
}
