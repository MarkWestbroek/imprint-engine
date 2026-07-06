import Link from "next/link";
import type { Page } from "@imprint/content-core";
import { store } from "@/lib/content";
import { Markdown } from "@/components/markdown";
import { StatusBadge } from "@/components/status-badge";
import type {
  ApiConfig,
  ProductsConfig,
  ReleasesConfig,
  TextConfig,
  TreeNode,
  TreeviewConfig,
} from "./registry";

/**
 * One React component per widget type (async server components, so widgets
 * may talk to the ContentStore or fetch external data). The config each
 * component receives has already been validated against the schema in
 * ./registry.ts by the store.
 */

type WidgetComponent = (props: { config: unknown }) => Promise<React.ReactNode>;

function WidgetFrame({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      {title && (
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

async function TextWidget({ config }: { config: TextConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <Markdown>{config.markdown}</Markdown>
    </WidgetFrame>
  );
}

/** Nest pages into a tree by their slug segments (e.g. posts/hello-world). */
function pagesToTree(pages: Page[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const page of pages) {
    let level = root;
    const segments = page.slug.split("/");
    segments.forEach((segment, i) => {
      const leaf = i === segments.length - 1;
      let node = level.find((n) => n.label === (leaf ? page.title : segment));
      if (!node) {
        node = leaf
          ? { label: page.title, href: `/${page.slug}` }
          : { label: segment, children: [] };
        level.push(node);
      }
      if (!leaf) level = node.children ?? (node.children = []);
    });
  }
  return root;
}

function Tree({ nodes }: { nodes: TreeNode[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {nodes.map((node) => (
        <li key={`${node.label}-${node.href ?? ""}`}>
          {node.href ? (
            <Link href={node.href} className="text-foreground hover:text-accent">
              {node.label}
            </Link>
          ) : (
            <span className="font-medium text-muted">{node.label}</span>
          )}
          {node.children && node.children.length > 0 && (
            <div className="mt-1 border-l border-line pl-3">
              <Tree nodes={node.children} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

async function TreeviewWidget({ config }: { config: TreeviewConfig }) {
  let nodes = config.items;
  if (config.pagesPrefix !== undefined) {
    const pages = await store.listPages({ prefix: config.pagesPrefix });
    nodes = [...nodes, ...pagesToTree(pages)];
  }
  return (
    <WidgetFrame title={config.title}>
      <Tree nodes={nodes} />
    </WidgetFrame>
  );
}

/** Walk a dot-path ("data.items.0.name") into a JSON value. */
function getPath(value: unknown, dotPath: string): unknown {
  return dotPath
    .split(".")
    .filter(Boolean)
    .reduce<unknown>(
      (v, key) =>
        typeof v === "object" && v !== null
          ? (v as Record<string, unknown>)[key]
          : undefined,
      value
    );
}

async function ApiWidget({ config }: { config: ApiConfig }) {
  let items: unknown[];
  try {
    const res = await fetch(config.url, { headers: config.headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: unknown = await res.json();
    const data = config.itemsPath ? getPath(json, config.itemsPath) : json;
    items = (Array.isArray(data) ? data : [data]).slice(0, config.limit);
  } catch (err) {
    // An unreachable API must not take the whole build down — show a notice.
    return (
      <WidgetFrame title={config.title}>
        <p className="text-sm text-muted">
          Could not load {new URL(config.url).hostname}:{" "}
          {err instanceof Error ? err.message : "unknown error"}
        </p>
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame title={config.title}>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="rounded-lg border border-line p-3 text-sm">
            {config.fields.length > 0 ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {config.fields.map((f) => (
                  <div key={f.path} className="contents">
                    <dt className="text-muted">{f.label}</dt>
                    <dd>{String(getPath(item, f.path) ?? "—")}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <pre className="overflow-x-auto font-mono text-xs">
                {JSON.stringify(item, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Source: {new URL(config.url).hostname}
      </p>
    </WidgetFrame>
  );
}

async function ReleasesWidget({ config }: { config: ReleasesConfig }) {
  const releases = (await store.listReleases({ project: config.project })).slice(
    0,
    config.limit
  );
  return (
    <WidgetFrame title={config.title}>
      <ul className="space-y-2 text-sm">
        {releases.map((r) => (
          <li key={`${r.project}-${r.version}`} className="flex flex-wrap items-baseline gap-2">
            <Link href="/releases" className="font-mono text-accent hover:underline">
              {r.project} v{r.version}
            </Link>
            <span className="text-muted">
              {r.date} · {r.channel}
            </span>
          </li>
        ))}
      </ul>
    </WidgetFrame>
  );
}

async function ProductsWidget({ config }: { config: ProductsConfig }) {
  const products = await store.listProducts();
  return (
    <WidgetFrame title={config.title}>
      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((p) => (
          <Link
            key={p.slug}
            href={`/products/${p.slug}`}
            className="rounded-lg border border-line p-4 hover:border-accent"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{p.name}</span>
              <StatusBadge status={p.status} />
            </div>
            <p className="mt-1 text-sm text-muted">{p.tagline}</p>
          </Link>
        ))}
      </div>
    </WidgetFrame>
  );
}

/**
 * WidgetType name → component. The `as WidgetComponent` casts are safe:
 * the store has validated each config against the matching schema before a
 * component ever sees it.
 */
export const widgetComponents: Record<string, WidgetComponent> = {
  text: TextWidget as WidgetComponent,
  treeview: TreeviewWidget as WidgetComponent,
  api: ApiWidget as WidgetComponent,
  releases: ReleasesWidget as WidgetComponent,
  products: ProductsWidget as WidgetComponent,
};
