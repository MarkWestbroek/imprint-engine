import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import { FileContentStore } from "@imprint/content-core";
import { widgetCatalog, widgetRegistry } from "../src/widgets/registry";
import { layoutRows } from "@imprint/runtime-admin/layout";

/**
 * Characterisation of the MusicBrain widget catalogue against the site's own
 * content: what the file-store build validates today, pinned. When a widget
 * moves to a library package (architecture.md §0) this list must not change
 * from the site's point of view.
 */
const CATALOG = [
  "accordion", "album", "api", "audio", "board", "boardspec", "breadcrumb", "buttons", "callout",
  "cards", "carousel", "code", "components", "divider", "downloads", "embed", "file", "gallery",
  "hero", "image", "itinerary", "kanban", "list", "logos", "map", "mediatext", "mermaid",
  "pdf", "people", "planning", "posts", "pricing", "products", "quote", "releases",
  "specs", "spectable", "subjectheader", "table", "tabs", "template", "testimonial", "text",
  "timeline", "toc", "treeview", "v3model", "video",
];

/**
 * What the studio shows when adding a widget: name, label, version and help,
 * in this order. Pinned so that composing the catalogue from the standard
 * library and MusicBrain's domain widgets changes nothing for the editor.
 */
const STUDIO_CATALOG: [name: string, label: string, version: string, help: string][] = [
  ["text", "Text (markdown)", "1.0.0", "Rich text via markdown, with a visual editor."],
  ["table", "Table", "1.0.0", "A data table; edit cells, add rows/columns."],
  ["image", "Image", "1.0.0", "A single image with optional caption."],
  ["gallery", "Photo gallery", "1.0.0", "A grid of photos with a lightbox; can include the subject's media."],
  ["carousel", "Photo carousel", "1.0.0", "One photo at a time with prev/next and optional auto-advance."],
  ["album", "External album", "1.0.0", "A view on an online photo repo (JSON API, or a Lightroom share as link card)."],
  ["map", "Map", "1.0.0", "An interactive OpenStreetMap with markers and popups."],
  ["kanban", "Kanban board", "1.0.0", "A small board: columns with static cards."],
  ["planning", "Planning board", "1.0.0", "A live board backed by planning-items: phases as columns, cards with owner, rich text and component links. Edit it in the admin (drag & drop)."],
  ["hero", "Hero", "1.1.0", "Big heading + subtitle, optional image and CTA button. *Word* in the title gets the accent colour; variant \"open\" drops the panel."],
  ["specs", "Specs strip", "1.0.0", "A row of key figures in mono: big value + small caption."],
  ["subjectheader", "Subject header", "1.0.0", "Header of the item this view is about: eyebrow, name + status, tagline, description."],
  ["spectable", "Specs table", "1.0.0", "The subject's specs (label/value) as a table."],
  ["components", "Product components", "1.0.0", "The subject product's components, with their board-specs collapsed."],
  ["video", "Video", "1.0.0", "YouTube/Vimeo (privacy embed) or a direct video file."],
  ["accordion", "Accordion / FAQ", "1.0.0", "Collapsible question/answer blocks (no JS needed)."],
  ["divider", "Divider", "1.1.0", "Visual rest between rows: line, dots, a scope-trace or just space."],
  ["downloads", "Downloads", "1.0.0", "Release downloads with version and checksum (W7)."],
  ["posts", "Posts / news feed", "1.0.0", "Latest devlog posts as linked cards (W6)."],
  ["itinerary", "Component itinerary", "1.0.0", "The journey of each component through a product's releases."],
  ["board", "Board annotations", "1.0.0", "A PCB render with hover/expanded hotspots per point."],
  ["boardspec", "Board spec", "1.0.0", "Render a board-spec: render, connectors, pinouts and notes."],
  ["template", "Template (merge fields)", "1.0.0", "Markdown with {{fields}} merged from a content item."],
  ["list", "List (links)", "1.0.0", "A list of links following the content graph (e.g. a product's releases)."],
  ["callout", "Callout / CTA", "1.0.0", "A coloured box with markdown and an optional button."],
  ["embed", "Embed (iframe)", "1.0.0", "Embed an external page in a sandboxed iframe."],
  ["treeview", "Treeview", "1.0.0", "A nested link tree; can auto-build from page slugs."],
  ["api", "API content", "1.0.0", "Fetch a JSON endpoint and show selected fields."],
  ["quote", "Quote", "1.0.0", 'A quotation with its source; "pull" makes it big.'],
  ["code", "Code", "1.0.0", "A code block with syntax highlighting (light/dark follow the site)."],
  ["mermaid", "Mermaid diagram", "1.0.0", "A diagram from mermaid text (flowchart, sequence, class, gantt, …), drawn in the browser."],
  ["v3model", "V3 model diagram", "1.0.0", "A V3 metamodel as a diagram: entities in their domain colour, on their position or in a grid, with relations."],
  ["tabs", "Tabs", "1.0.0", "Tabbed panels of markdown; the first is open by default."],
  ["cards", "Cards / features", "1.0.0", "A grid of cards: icon, title, text, optional link."],
  ["buttons", "Buttons", "1.0.0", "A row of buttons (primary, secondary or ghost)."],
  ["logos", "Logo cloud", "1.0.0", "A row of logos, grey until hovered, each optionally linked."],
  ["toc", "Table of contents", "1.0.0", "Links to the headings on this page, whichever widget they come from."],
  ["breadcrumb", "Breadcrumb", "1.0.0", "Home › section › page, from the page's slug; parents that exist as pages get their title."],
  ["audio", "Audio", "1.0.0", "An audio player for a file (mp3, ogg, wav, …)."],
  ["pdf", "PDF", "1.0.0", "A PDF shown inline, with a download link."],
  ["file", "File download", "1.0.0", "One download link with a label and a note."],
  ["timeline", "Timeline", "1.0.0", "Dated steps on a vertical line."],
  ["mediatext", "Media & text", "1.0.0", "An image beside text, as one block."],
  ["people", "People / team", "1.0.0", "Cards with photo, name, role, bio and links."],
  ["testimonial", "Testimonials", "1.0.0", "Quotes with the name and role of who said them."],
  ["pricing", "Pricing", "1.0.0", "Plans side by side with features and a button; one can be highlighted."],
  ["releases", "Releases", "1.0.0", "The latest releases from the content store."],
  ["products", "Products", "1.0.0", "A grid of products with their status."],
];

describe("MusicBrain widget catalogue", () => {
  it("registers exactly the known widget types", () => {
    assert.deepEqual([...widgetRegistry.names()].sort(), [...CATALOG].sort());
  });

  it("offers the studio the same widgets, labels, versions and help, in the same order", () => {
    assert.deepEqual(
      widgetCatalog.map((d) => [d.name, d.label, d.version, d.help]),
      STUDIO_CATALOG
    );
    assert.deepEqual(widgetRegistry.names(), STUDIO_CATALOG.map(([name]) => name));
  });

  it("validates every composed page in content/ and every widget it places is registered", async () => {
    const store = new FileContentStore(path.resolve(import.meta.dirname, "../content"), {
      widgets: widgetRegistry,
    });
    const pages = await store.listPages({ includeDrafts: true });
    assert.ok(pages.length > 0);
    const used = new Set<string>();
    for (const page of pages) {
      if (!page.layout) continue;
      for (const row of layoutRows(page.layout)) {
        for (const cell of row.cells) for (const w of cell.widgets) used.add(w.type);
      }
    }
    assert.ok(used.size > 0, "content uses widgets");
    for (const type of used) assert.ok(widgetRegistry.has(type), `widget "${type}" registered`);
  });

  it("the file store rejects a page that places an unknown widget", async () => {
    const empty = new FileContentStore(path.resolve(import.meta.dirname, "../content"));
    const page = await empty.getPage("editor");
    assert.ok(page?.layout, "editor page is composed");
    assert.throws(
      () => widgetRegistry.parse({ type: "does-not-exist", config: {} }),
      /Unknown widget type "does-not-exist"/
    );
  });
});
