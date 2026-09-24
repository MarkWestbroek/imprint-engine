import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { PageLayoutSchema, type Page, type PageLayout } from "@imprint/content-core";
import type { MemoryContentStore } from "@imprint/content-core/memory-store";
import { DefaultView, PageRenderer, Widget, type WidgetContext } from "@imprint/runtime-admin";
import { menuToNav, SiteChrome } from "../../src/components/site-chrome";
import { widgetComponents } from "../../src/widgets/components";
import { widgetRegistry } from "../../src/widgets/registry";
import { buildStore, CANNED_RESPONSES, PAGE_CASES, resolveSubject, WIDGET_CASES } from "./fixtures";
import { expectGolden, formatHtml, installFetchMock, renderHtml, unexpectedFetches } from "./harness";

/**
 * Characterisation of the public renderer (Fase 2): the HTML that the engine
 * renderer produces with MusicBrain's viewers — every widget, whole pages,
 * default views — plus SiteChrome, pinned in `__golden__/`. Recorded before
 * the renderer moved into the engine (step 1); every later step must leave
 * these files untouched.
 *
 * The WidgetContext is the in-memory backend with a write side, i.e. the
 * database configuration production runs, and `readOptions: {}`, i.e. what
 * every visitor gets outside the as-of preview.
 *
 * Intended rendering change? `UPDATE_GOLDEN=1 npm test --workspace=musicbrain`
 * and review the golden diff.
 */

let store: MemoryContentStore;
let ctx: WidgetContext;

before(async () => {
  store = await buildStore();
  // `page` is what the renderer sets on a real page; the breadcrumb widget reads it.
  ctx = { store, writableStore: store, readOptions: {}, page: { slug: "about/team", title: "Team" } };
  installFetchMock(CANNED_RESPONSES);
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
          const html = await renderHtml(
            <Widget widget={widget} subject={subject} viewers={widgetComponents} ctx={ctx} />
          );
          parts.push(`<!-- case: ${c.name} -->\n${formatHtml(html)}`);
        }
        await expectGolden(`widgets/${type}`, parts.join("\n"));
      });
    }

    it("an unregistered widget type fails the render instead of rendering nothing", async () => {
      await assert.rejects(
        renderHtml(
          <Widget widget={{ type: "does-not-exist", config: {} }} viewers={widgetComponents} ctx={ctx} />
        ),
        /No component for widget type "does-not-exist"/
      );
    });
  });

  describe("PageRenderer", () => {
    for (const c of PAGE_CASES) {
      it(c.name, async () => {
        const page = { ...c.page, layout: parseLayout(c.page.layout) } as Page & { layout: PageLayout };
        const subject = c.subject ? await resolveSubject(store, c.subject) : undefined;
        const html = await renderHtml(
          <PageRenderer page={page} subject={subject} viewers={widgetComponents} ctx={ctx} />
        );
        await expectGolden(`pages/${c.name}`, formatHtml(html));
      });
    }
  });

  describe("DefaultView", () => {
    const fallback = <p>hand-coded fallback</p>;

    it("a view with its own subjectheader suppresses the page title", async () => {
      const subject = await resolveSubject(store, "product:cortex");
      const html = await renderHtml(
        <DefaultView
          type="product"
          subject={subject}
          title="Cortex"
          fallback={fallback}
          viewers={widgetComponents}
          ctx={ctx}
        />
      );
      assert.ok(!html.includes("hand-coded fallback"));
      await expectGolden("default-view/product", formatHtml(html));
    });

    it("a view without a subjectheader keeps the title", async () => {
      const subject = await resolveSubject(store, "component:adc8");
      const html = await renderHtml(
        <DefaultView
          type="component"
          subject={subject}
          title="ADC8"
          fallback={fallback}
          viewers={widgetComponents}
          ctx={ctx}
        />
      );
      await expectGolden("default-view/component", formatHtml(html));
    });

    it("no view page renders the hand-coded fallback", async () => {
      const html = await renderHtml(
        <DefaultView
          type="release"
          subject={{}}
          title="v0.2"
          fallback={fallback}
          viewers={widgetComponents}
          ctx={ctx}
        />
      );
      assert.equal(html, "<p>hand-coded fallback</p>");
    });
  });

  describe("SiteChrome", () => {
    it("header with menu and theme switcher, footer with links", async () => {
      const site = await store.getSiteConfig();
      const nav = menuToNav(await store.getMenu("main"));
      const themes = await store.listThemes();
      const html = await renderHtml(
        <SiteChrome site={site} nav={nav} themes={themes}>
          <p>page content</p>
        </SiteChrome>
      );
      await expectGolden("chrome/public", formatHtml(html));
    });

    it("studio mode (inert) with the fallback nav and no themes", async () => {
      const site = await store.getSiteConfig();
      const html = await renderHtml(
        <SiteChrome site={site} nav={menuToNav(null)} inert>
          <p>canvas</p>
        </SiteChrome>
      );
      await expectGolden("chrome/studio-inert", formatHtml(html));
    });
  });

  it("fetched only the canned endpoints (no network)", () => {
    assert.deepEqual(unexpectedFetches, []);
  });
});
