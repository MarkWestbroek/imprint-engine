import type { PageLayout, WidgetInstance } from "@imprint/content-core";
import { guardReads, userSubject } from "@imprint/content-core";
import {
  AddWidgetButton,
  CellChrome,
  InsertRowBar,
  PreviewAsPicker,
  RowChrome,
  StudioProvider,
  StudioSidebar,
  StudioTopBar,
  WidgetShell,
} from "../admin/studio-parts";
import type { AdminContext } from "../admin-context";
import { viewTargetType } from "../default-view";
import { layoutRows } from "../layout";
import { Markdown } from "../markdown";
import { Widget, type WidgetContext } from "../page-renderer";
import { readOpts } from "../preview";
import type { PageDraft } from "../studio/layout-ops";
import type { AdminActions } from "./actions";
import { draftKey, getDraft, setDraft } from "./drafts";

/**
 * Server half of the page studio: loads (or initialises) the draft, renders
 * the canvas with the *real* widget viewers inside the site's *real* chrome,
 * and hands selection, toolbars and sidebar to the client parts. Every draft
 * mutation triggers router.refresh(), which re-runs this component — that is
 * the "parameters aanpassen toont meteen het effect" loop.
 *
 * What the site supplies (`AdminContext.studio`): its viewers, its chrome
 * (one component around the canvas, design/fase-4 decision) and, optionally,
 * its widget editor. Everything else — drafts, forms, the widget context —
 * the package builds itself.
 */
export async function PageStudioScreen({
  admin,
  actions,
  slug,
  lang,
  previewAs,
}: {
  admin: AdminContext;
  actions: Pick<AdminActions, "studio">;
  slug?: string;
  lang: string;
  /** When editing a default-view template, the sample item to bind as subject. */
  previewAs?: string;
}) {
  const studio = admin.studio;
  if (!studio) {
    return (
      <p className="text-sm text-muted">
        This site has no studio: give the admin context a <code>studio</code> (viewers and chrome).
      </p>
    );
  }
  const session = (await admin.auth.editingSession())!; // the gate guarantees a session
  const store = admin.imprint.writableStore!;
  const key = draftKey(admin.imprint.id, session.name, slug, lang);

  // A page at slug "_view/<type>" is that content type's default view; while
  // editing it we bind a sample item as the subject so the preview fills in.
  const targetType = viewTargetType(slug);
  let subject: unknown;
  let samples: string[] = [];
  if (targetType) {
    const items = await store.listItems(targetType);
    samples = items.map((i) => i.slug);
    const chosen = previewAs ? items.find((i) => i.slug === previewAs) : items[0];
    subject = chosen?.data;
  }

  let draft = getDraft(key);
  if (!draft) {
    const item = slug ? await store.getItem("page", slug, lang) : null;
    const data = (item?.data as Record<string, unknown>) ?? {
      slug: "",
      lang,
      title: "",
      description: "",
      draft: false,
    };
    const { body, layout, ...meta } = data as { body?: string; layout?: PageLayout } & Record<string, unknown>;
    draft = {
      meta,
      body: typeof body === "string" ? body : "",
      rows: layout ? layoutRows(layout) : [],
    } satisfies PageDraft;
    setDraft(key, draft);
  }

  // The canvas reads as the editor: restricted items included, drafts too.
  const who = userSubject(session.name, session.role);
  const ctx: WidgetContext = {
    store: admin.imprint.storeFor(who),
    writableStore: guardReads(store, who, admin.imprint.pdp),
    readOptions: { ...(await readOpts()), includeDrafts: true },
  };
  const widgetSchemas = admin.forms.widgets();
  const widgetLabel = (type: string) => widgetSchemas.find((w) => w.name === type)?.label ?? type;
  const title = targetType ? `Default view: ${targetType}` : String(draft.meta.title ?? "") || "Untitled";
  const Chrome = studio.chrome;

  /** Real viewer when the config validates; a friendly placeholder until then. */
  const preview = (widget: WidgetInstance) => {
    let valid: WidgetInstance;
    try {
      valid = admin.imprint.widgets.parse(widget);
    } catch {
      return (
        <div className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
          <span className="font-medium text-foreground">{widgetLabel(widget.type)}</span> needs
          configuration — its settings are open in the sidebar.
        </div>
      );
    }
    return <Widget widget={valid} subject={subject} viewers={studio.viewers} ctx={ctx} />;
  };

  return (
    <StudioProvider
      slug={slug}
      lang={lang}
      meta={draft.meta}
      body={draft.body}
      rows={draft.rows}
      metaSchema={admin.forms.content("page")}
      widgetSchemas={widgetSchemas}
      actions={actions.studio}
      editor={studio.editor}
    >
      <StudioTopBar isNew={!slug} />
      {targetType && <PreviewAsPicker lang={lang} current={previewAs} samples={samples} />}
      <div className="flex items-start gap-4">
        <StudioSidebar />

        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-line">
          <div className="flex min-h-[60vh] flex-col bg-background">
            <Chrome>
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
                          ["--cols" as string]: row.cells.map((cell) => `minmax(0,${cell.span}fr)`).join(" "),
                        }}
                      >
                        {row.cells.map((cell, c) => (
                          <CellChrome key={c} r={r} c={c} span={cell.span} canDelete={row.cells.length > 1}>
                            {cell.widgets.map((widget, w) => (
                              <WidgetShell key={w} path={{ r, c, w }} label={widgetLabel(widget.type)}>
                                {preview(widget)}
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
            </Chrome>
          </div>
        </div>
      </div>
    </StudioProvider>
  );
}
