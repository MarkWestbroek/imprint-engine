import type { Metadata } from "next";
import Link from "next/link";
import { store } from "@/lib/content";
import { readOpts } from "@/lib/preview";
import { displayVersion } from "@/lib/format";

export const metadata: Metadata = {
  title: "Boards",
  description: "Every documented board revision, straight from the KiCad toolchain.",
};

/** Index of all board-specs (backlog §4) — until now only reachable via their component. */
export default async function BoardsPage() {
  const opts = await readOpts();
  const [specs, components] = await Promise.all([
    store.listBoardSpecs(opts),
    store.listComponents(opts),
  ]);
  const componentName = new Map(components.map((c) => [c.slug, c.name]));

  const sorted = [...specs].sort(
    (a, b) =>
      a.component.localeCompare(b.component) ||
      b.version.localeCompare(a.version, undefined, { numeric: true })
  );

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Boards</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Every documented board revision, published straight from the KiCad toolchain. Each card
        links to its component, where the full spec (connectors, pinouts, fab notes) lives.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((spec) => {
          const image = spec.assets.renderTop ?? spec.assets.overview;
          return (
            <Link
              key={spec.slug}
              href={`/components/${spec.component}`}
              className="group rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent"
            >
              {image && (
                <div className="mb-3 overflow-hidden rounded-lg border border-line bg-background">
                  {/* Board renders vary in size/ratio; plain img + contain keeps them whole. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt={`${spec.component} ${spec.version} render`}
                    className="aspect-[4/3] w-full object-contain"
                    loading="lazy"
                  />
                </div>
              )}
              <h2 className="font-semibold group-hover:text-accent">
                {componentName.get(spec.component) ?? spec.component}
              </h2>
              <p className="mt-1 font-mono text-sm text-muted">
                {displayVersion(spec.version)}
                {spec.connectors.length > 0 && (
                  <span>
                    {" "}
                    · {spec.connectors.length} connector{spec.connectors.length === 1 ? "" : "s"}
                  </span>
                )}
              </p>
            </Link>
          );
        })}
      </div>

      {sorted.length === 0 && <p className="mt-8 text-muted">No boards published yet.</p>}
    </div>
  );
}
