import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { PageLayoutSchema, type Page, type PageLayout } from "@imprint/content-core";
import type { MemoryContentStore } from "@imprint/content-core/memory-store";
import type * as DefaultViewModule from "../../src/components/default-view";
import type * as PageRendererModule from "../../src/components/page-renderer";
import type * as SiteChromeModule from "../../src/components/site-chrome";
import { widgetRegistry } from "../../src/widgets/registry";
import { buildStore, CANNED_RESPONSES, PAGE_CASES, resolveSubject, WIDGET_CASES } from "./fixtures";
import { expectGolden, formatHtml, installRenderMocks, renderHtml, unexpectedFetches } from "./harness";

/**
 * Characterisation of the public renderer (Fase 2, step 1): the HTML that
 * PageRenderer, every widget viewer, DefaultView and SiteChrome produce
 * *today*, pinned in `__golden__/`. Fase 2 moves these into the engine and
 * rewires their context; this suite is the proof that the output didn't
 * change. The store is the in-memory backend with a write side, i.e. the
 * database configuration production runs, not the file-store hint paths.
 *
 * Intended rendering change? `UPDATE_GOLDEN=1 npm test --workspace=musicbrain`
 * and review the golden diff.
 */

let store: MemoryContentStore;
let renderer: typeof PageRendererModule;
let defaultView: typeof DefaultViewModule;
let chrome: typeof SiteChromeModule;

before(async () => {
  store = await buildStore();
  installRenderMocks({ store, writableStore: store, responses: CANNED_RESPONSES });
  // Only now, with the mocks in place, load the components.
  renderer = await import("../../src/components/page-renderer");
  defaultView = await import("../../src/components/default-view");
  chrome = await import("../../src/components/site-chrome");
});

const parseLayout = (layout: unknown): PageLayout => widgetRegistry.parseLayout(PageLayoutSchema.parse(layout));

describe("renderer characterisation", () => {
  it("covers every registered widget type", () => {
    assert.deepEqual(Object.keys(WIDGET_CASES).sort(), widgetRegistry.names().sort());
  });

  describe("widget viewers", () => {
    for (const [type, cases] of Object.entries(WIDGET_CASES)) {
      it(type, async () => {
        const parts: string[] = [];
        for (const c of cases) {
          // Parsed like the store does: viewers only ever see validated configs.
          const widget = widgetRegistry.parse({ type, config: c.config });
          const subject = c.subject ? await resolveSubject(store, c.subject) : undefined;
          const html = await renderHtml(<renderer.Widget widget={widget} subject={subject} />);
          parts.push(`<!-- case: ${c.name} -->\n${formatHtml(html)}`);
        }
        await expectGolden(`widgets/${type}`, parts.join("\n"));
      });
    }

    it("an unregistered widget type throws instead of rendering nothing", () => {
      assert.throws(
        () => renderer.Widget({ widget: { type: "does-not-exist", config: {} } }),
        /No component for widget type "does-not-exist"/
      );
    });
  });

  describe("PageRenderer", () => {
    for (const c of PAGE_CASES) {
      it(c.name, async () => {
        const page = { ...c.page, layout: parseLayout(c.page.layout) } as Page & { layout: PageLayout };
        const subject = c.subject ? await resolveSubject(store, c.subject) : undefined;
        const html = await renderHtml(<renderer.PageRenderer page={page} subject={subject} />);
        await expectGolden(`pages/${c.name}`, formatHtml(html));
      });
    }
  });

  describe("DefaultView", () => {
    const fallback = <p>hand-coded fallback</p>;

    it("a view with its own subjectheader suppresses the page title", async () => {
      const subject = await resolveSubject(store, "product:cortex");
      const html = await renderHtml(
        <defaultView.DefaultView type="product" subject={subject} title="Cortex" fallback={fallback} />
      );
      assert.ok(!html.includes("hand-coded fallback"));
      await expectGolden("default-view/product", formatHtml(html));
    });

    it("a view without a subjectheader keeps the title", async () => {
      const subject = await resolveSubject(store, "component:adc8");
      const html = await renderHtml(
        <defaultView.DefaultView type="component" subject={subject} title="ADC8" fallback={fallback} />
      );
      await expectGolden("default-view/component", formatHtml(html));
    });

    it("no view page renders the hand-coded fallback", async () => {
      const html = await renderHtml(
        <defaultView.DefaultView type="release" subject={{}} title="v0.2" fallback={fallback} />
      );
      assert.equal(html, "<p>hand-coded fallback</p>");
    });
  });

  describe("SiteChrome", () => {
    it("header with menu and theme switcher, footer with links", async () => {
      const site = await store.getSiteConfig();
      const nav = chrome.menuToNav(await store.getMenu("main"));
      const themes = await store.listThemes();
      const html = await renderHtml(
        <chrome.SiteChrome site={site} nav={nav} themes={themes}>
          <p>page content</p>
        </chrome.SiteChrome>
      );
      await expectGolden("chrome/public", formatHtml(html));
    });

    it("studio mode (inert) with the fallback nav and no themes", async () => {
      const site = await store.getSiteConfig();
      const html = await renderHtml(
        <chrome.SiteChrome site={site} nav={chrome.menuToNav(null)} inert>
          <p>canvas</p>
        </chrome.SiteChrome>
      );
      await expectGolden("chrome/studio-inert", formatHtml(html));
    });
  });

  it("fetched only the canned endpoints (no network)", () => {
    assert.deepEqual(unexpectedFetches, []);
  });
});
