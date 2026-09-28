"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { marked } from "marked";
import TurndownService from "turndown";
import { assetRefUrl } from "../media/ref";
import { AssetPicker } from "./asset-field";
import { promptDialog } from "./dialog";

/**
 * Markdown field with two tabs: "Visueel" (a WYSIWYG surface — TipTap, since
 * step 6 of design/beeldbibliotheek.md) and "Markdown" (the raw source, always
 * the escape hatch). Markdown stays the source of truth: the visual editor
 * reads it through marked (md→html) and writes it back through turndown
 * (html→md), so anything it can't express you can still fix in the Markdown
 * tab, and stored content does not change shape.
 *
 * Images come from the media library: the image button opens the same picker
 * as the forms and stores `![alt](asset:<slug>)`. In the editor such an image
 * is shown through the ref route (`/api/assets/_ref/<slug>`) and carries its
 * reference in `data-asset`, so turndown writes the reference back — never
 * the URL it happened to be shown with.
 */

marked.setOptions({ gfm: true });
const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
turndown.addRule("assetImage", {
  filter: (node) => node.nodeName === "IMG" && (node as HTMLElement).hasAttribute("data-asset"),
  replacement: (_content, node) => {
    const el = node as HTMLElement;
    const alt = (el.getAttribute("alt") ?? "").replace(/[[\]]/g, "");
    return `![${alt}](asset:${el.getAttribute("data-asset")})`;
  },
});

/** md → html for the editor: `asset:` images get the ref route to show, and their reference in `data-asset`. */
function mdToHtml(md: string): string {
  const html = String(marked.parse(md, { async: false }));
  return html.replace(/<img src="asset:([^"]+)"/g, (_m, slug: string) => `<img src="${assetRefUrl(`asset:${slug}`)}" data-asset="${slug}"`);
}
const htmlToMd = (html: string): string => turndown.turndown(html).trim();

/** TipTap's image, keeping the library reference next to the URL it is shown with. */
const AssetImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      asset: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-asset"),
        renderHTML: (attrs) => (attrs.asset ? { "data-asset": attrs.asset } : {}),
      },
    };
  },
});

type Mode = "visual" | "markdown";

export function MarkdownEditor({
  value,
  onChange,
  rows = 8,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  const [mode, setMode] = useState<Mode>("visual");
  const [picking, setPicking] = useState(false);
  // The markdown this editor last produced: an incoming value equal to it is our own echo.
  const lastOut = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      AssetImage.configure({ inline: false }),
    ],
    content: mdToHtml(value) || "<p></p>",
    // Rendered on the client only: no server HTML to hydrate against.
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "markdown min-h-32 bg-background px-3 py-2 text-sm focus:outline-none", "aria-label": "Text" },
    },
    onUpdate: ({ editor: ed }) => {
      const md = htmlToMd(ed.getHTML());
      lastOut.current = md;
      onChange(md);
    },
  });

  // Back from the Markdown tab (or a value set from outside): load it into the visual editor.
  useEffect(() => {
    if (!editor || mode !== "visual" || value === lastOut.current) return;
    lastOut.current = value;
    editor.commands.setContent(mdToHtml(value) || "<p></p>", { emitUpdate: false });
  }, [editor, mode, value]);

  return (
    <div className="overflow-hidden rounded-md border border-line focus-within:border-accent">
      <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface px-2 py-1 text-xs">
        <Tab active={mode === "visual"} onClick={() => setMode("visual")}>
          Visueel
        </Tab>
        <Tab active={mode === "markdown"} onClick={() => setMode("markdown")}>
          Markdown
        </Tab>
        {mode === "visual" && editor && <Toolbar editor={editor} onImage={() => setPicking(true)} />}
      </div>

      {mode === "visual" ? (
        <EditorContent editor={editor} />
      ) : (
        <textarea
          className="block w-full resize-y bg-background px-2.5 py-1.5 font-mono text-sm focus:outline-none"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Markdown…"
          aria-label="Markdown source"
        />
      )}

      {picking && editor && (
        <AssetPicker
          kinds={["image", "svg"]}
          onClose={() => setPicking(false)}
          onPick={(slug, entry) => {
            setPicking(false);
            editor
              .chain()
              .focus()
              .insertContent({ type: "image", attrs: { src: assetRefUrl(`asset:${slug}`), alt: entry?.alt || entry?.title || "", asset: slug } })
              .run();
          }}
        />
      )}
    </div>
  );
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const on = (name: string, attrs?: Record<string, unknown>) => editor.isActive(name, attrs);
  return (
    <>
      <span className="mx-1 h-4 w-px bg-line" />
      <Btn title="Bold" active={on("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </Btn>
      <Btn title="Italic" active={on("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <i>I</i>
      </Btn>
      <Btn title="Heading" active={on("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </Btn>
      <Btn title="Subheading" active={on("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </Btn>
      <Btn title="Paragraph" active={on("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()}>
        ¶
      </Btn>
      <Btn title="Inline code" active={on("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        {"</>"}
      </Btn>
      <Btn title="Bulleted list" active={on("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •
      </Btn>
      <Btn title="Numbered list" active={on("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.
      </Btn>
      <Btn title="Quote" active={on("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        ❝
      </Btn>
      <Btn
        title="Link"
        active={on("link")}
        onClick={async () => {
          const current = editor.getAttributes("link").href as string | undefined;
          const url = await promptDialog("Link-URL (leeg = link weghalen)", {
            placeholder: "https://… of /pagina",
            initial: current ?? "",
            confirmLabel: "Link",
          });
          if (url === null) return;
          const chain = editor.chain().focus().extendMarkRange("link");
          if (url.trim()) chain.setLink({ href: url.trim() }).run();
          else chain.unsetLink().run();
        }}
      >
        🔗
      </Btn>
      <Btn title="Image from the library" onClick={onImage}>
        🖼
      </Btn>
      <Btn title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        ―
      </Btn>
      <span className="mx-1 h-4 w-px bg-line" />
      <Btn title="Undo" onClick={() => editor.chain().focus().undo().run()}>
        ↶
      </Btn>
      <Btn title="Redo" onClick={() => editor.chain().focus().redo().run()}>
        ↷
      </Btn>
    </>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded px-2 py-0.5 font-medium ${active ? "bg-accent text-background" : "text-muted hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function Btn({ title, active, onClick, children }: { title: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      // Keep the selection: prevent the button from stealing focus on mousedown.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded border px-1.5 py-0.5 ${
        active ? "border-accent text-foreground" : "border-line text-muted hover:border-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
