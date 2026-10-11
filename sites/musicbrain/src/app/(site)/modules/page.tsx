import type { Metadata } from "next";
import Link from "next/link";
import { store } from "@/lib/content";
import { readOpts } from "@/lib/preview";
import { displayVersion } from "@/lib/format";
import { isModule } from "@/lib/modules";

export const metadata: Metadata = {
  title: "Modules",
  description: "The software modules of the firmware: what each one does, its controls and ports, and patches to try it with.",
};

/**
 * Index of the firmware's modules (lib/modules.ts): their narrow panels side
 * by side, the newest version of each. The boards keep their own index on /boards.
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
  const modules = [...newest.values()].sort((a, b) =>
    (byComponent.get(a.component)?.name ?? a.component).localeCompare(byComponent.get(b.component)?.name ?? b.component)
  );

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Modules</h1>
      <p className="mt-2 max-w-3xl text-muted">
        The software modules of the firmware. Each one runs on the Brain and in the editor&apos;s simulator alike;
        its page has the controls, the ports, how it works and patches to try it with.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {modules.map((spec) => {
          const component = byComponent.get(spec.component);
          const image = spec.assets.renderTop ?? spec.assets.overview;
          return (
            <Link
              key={spec.component}
              href={`/components/${spec.component}`}
              className="group flex flex-col rounded-xl border border-line bg-surface p-3 transition-colors hover:border-accent"
            >
              {image && (
                <div className="mb-3 flex h-56 items-center justify-center">
                  {/* Panels are narrow and tall; contain keeps each one whole. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt={`${component?.name ?? spec.component} panel`} className="max-h-full max-w-full object-contain" loading="lazy" />
                </div>
              )}
              <h2 className="font-semibold group-hover:text-accent">{component?.name ?? spec.component}</h2>
              {component?.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{component.description}</p>}
              <p className="mt-auto pt-2 font-mono text-xs text-muted">{displayVersion(spec.version)}</p>
            </Link>
          );
        })}
      </div>

      {modules.length === 0 && <p className="mt-8 text-muted">No modules published yet.</p>}
    </div>
  );
}
