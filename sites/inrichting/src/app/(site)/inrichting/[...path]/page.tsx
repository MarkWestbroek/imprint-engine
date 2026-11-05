import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { omniumPage } from "@imprint/plugin-omnium/page";
import { widgetContext } from "@/lib/widget-context";
import { widgetComponents } from "@/widgets/components";

/**
 * A record of the Omnium register by its stable key (design/omnium-inrichting.md
 * §3.4), rendered with the studio template `_view/omnium-<pad>` or the
 * plugin's built-in view. `?peiltijdstip=` (RFC 3339) and `?geldigOp=` (a
 * date) show the register as it was; on a drawing, `?element=` lights up one
 * element (a form field links there from its traceregel).
 */

type Props = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ peiltijdstip?: string; geldigOp?: string; element?: string }>;
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
