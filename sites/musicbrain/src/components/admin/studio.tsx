import type { PageLayout, WidgetInstance } from "@imprint/content-core";
import { getSession } from "@/lib/auth";
import { store, writableStore } from "@/lib/content";
import { contentFormSchema, widgetFormSchemas } from "@/lib/admin-schemas";
import { draftKey, getDraft, setDraft } from "@/lib/page-draft";
import type { PageDraft } from "@/lib/layout-ops";
import { layoutRows } from "@/widgets/templates";
import { widgetRegistry, widgetCatalog } from "@/widgets/registry";
import { Widget } from "@/components/page-renderer";
import { Markdown } from "@/components/markdown";
import { menuToNav, SiteChrome } from "@/components/site-chrome";
import {
  AddWidgetButton,
  CellChrome,
  InsertRowBar,
  RowChrome,
  StudioProvider,
  StudioSidebar,
  StudioTopBar,
  WidgetShell,
} from "./studio-parts";

/**
 * Server half of the page studio: loads (or initializes) the draft, renders
 * the canvas with the *real* widget viewers inside the *real* site chrome,
 * and hands selection/toolbars/sidebar to the client parts. Every draft
 * mutation triggers router.refresh(), which re-runs this component — that's
 * the "parameters aanpassen toont meteen het effect" loop.
 */
export async function PageStudio({ slug, lang }: { slug?: string; lang: string }) {
  const session = (await getSession())!; // admin layout guarantees a session
  const key = draftKey(session.name, slug, lang);

  let draft = getDraft(key);
  if (!draft) {
    const item = slug ? await writableStore!.getItem("page", slug, lang) : null;
    const data = (item?.data as Record<string, unknown>) ?? {
      slug: "",
      lang,
      title: "",
      description: "",
      draft: false,
    };
    const { body, layout, ...meta } = data as {
      body?: string;
      layout?: PageLayout;
    } & Record<string, unknown>;
    draft = {
      meta,
      body: typeof body === "string" ? body : "",
      rows: layout ? layoutRows(layout) : [],
    } satisfies PageDraft;
    setDraft(key, draft);
  }

  const site = await store.getSiteConfig();
  const menu = await store.getMenu("main");
  const title = String(draft.meta.title ?? "") || "Untitled";

  return (
    <StudioProvider
      slug={slug}
      lang={lang}
      meta={draft.meta}
      body={draft.body}
      rows={draft.rows}
      metaSchema={contentFormSchema("page")}
      widgetSchemas={widgetFormSchemas()}
    >
      <StudioTopBar isNew={!slug} />
      <div className="flex items-start gap-4">
        <StudioSidebar />

        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-line">
          <div className="flex min-h-[60vh] flex-col bg-background">
            <SiteChrome site={site} nav={menuToNav(menu)} inert>
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              {draft.body && (
                <div className="mt-4 max-w-3xl">
                  <Markdown>{draft.body}</Markdown>
                </div>
              )}
              <div className="mt-6">
                {draft.rows.length === 0 && <InsertRowBar at={0} prominent />}
                {draft.rows.length > 0 && <InsertRowBar at={0} />}
                {draft.rows.map((row, r) => (
                  <div key={r}>
                    <RowChrome r={r} cellCount={row.cells.length}>
                      <div
                        className="grid items-start gap-3 lg:[grid-template-columns:var(--cols)]"
                        style={{
                          ["--cols" as string]: row.cells
                            .map((cell) => `minmax(0,${cell.span}fr)`)
                            .join(" "),
                        }}
                      >
                        {row.cells.map((cell, c) => (
                          <CellChrome
                            key={c}
                            r={r}
                            c={c}
                            span={cell.span}
                            canDelete={row.cells.length > 1}
                          >
                            {cell.widgets.map((widget, w) => (
                              <WidgetShell
                                key={w}
                                path={{ r, c, w }}
                                label={widgetLabel(widget.type)}
                              >
                                <WidgetPreview widget={widget} />
                              </WidgetShell>
                            ))}
                            <AddWidgetButton r={r} c={c} widgetCount={cell.widgets.length} />
                          </CellChrome>
                        ))}
                      </div>
                    </RowChrome>
                    <InsertRowBar at={r + 1} />
                  </div>
                ))}
              </div>
            </SiteChrome>
          </div>
        </div>
      </div>
    </StudioProvider>
  );
}

function widgetLabel(type: string): string {
  return widgetCatalog.find((w) => w.name === type)?.label ?? type;
}

/** Real viewer when the config validates; a friendly placeholder until then. */
function WidgetPreview({ widget }: { widget: WidgetInstance }) {
  let valid: WidgetInstance;
  try {
    valid = widgetRegistry.parse(widget);
  } catch {
    return (
      <div className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
        <span className="font-medium text-foreground">{widgetLabel(widget.type)}</span>{" "}
        needs configuration — its settings are open in the sidebar.
      </div>
    );
  }
  return <Widget widget={valid} />;
}
