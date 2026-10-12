import type { Metadata } from "next";
import { store } from "@/lib/content";
import { readOpts } from "@/lib/preview";
import { displayVersion } from "@/lib/format";
import { isModule } from "@/lib/modules";
import { ModulesBrowser, type ModuleCard } from "@/components/modules-browser";

export const metadata: Metadata = {
  title: "Modules",
  description: "The software modules of the firmware: what each one does, its controls and ports, and patches to try it with.",
};

/**
 * Index of the firmware's modules (lib/modules.ts), the newest version of
 * each, grouped by family with tags to filter on (ModulesBrowser). The boards
 * keep their own index on /boards.
 */
export default async function ModulesPage() {
  const opts = await readOpts();
  const [specs, components] = await Promise.all([store.listBoardSpecs(opts), store.listComponents(opts)]);
  const byComponent = new Map(components.map((c) => [c.slug, c]));
  const newest = new Map<string, (typeof specs)[number]>();
  for (const spec of specs) {
    const component = byComponent.get(spec.component);
    if (!isModule(spec.component, spec.kind ?? component?.kind)) continue;
    const seen = newest.get(spec.component);
    if (!seen || spec.version.localeCompare(seen.version, undefined, { numeric: true }) > 0) newest.set(spec.component, spec);
  }
  const cards: ModuleCard[] = [...newest.values()].map((spec) => {
    const component = byComponent.get(spec.component);
    const image = spec.assets.renderTop ?? spec.assets.overview;
    return {
      slug: spec.component,
      name: component?.name ?? spec.component,
      description: component?.description ?? "",
      version: displayVersion(spec.version),
      ...(image ? { image } : {}),
      family: component?.family ?? "",
      tags: component?.tags ?? [],
    };
  });

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Modules</h1>
      <p className="mt-2 max-w-3xl text-muted">
        The software modules of the firmware. Each one runs on the Brain and in the editor&apos;s simulator alike;
        its page has the controls, the ports, how it works and patches to try it with.
      </p>
      {cards.length > 0 ? <ModulesBrowser modules={cards} /> : <p className="mt-8 text-muted">No modules published yet.</p>}
    </div>
  );
}
