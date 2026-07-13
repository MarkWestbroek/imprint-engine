"use client";

import { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import TurndownService from "turndown";

/**
 * Markdown field with two tabs: "Visueel" (a WYSIWYG surface — you edit the
 * formatted text directly) and "Markdown" (the raw source, always the escape
 * hatch). Markdown is the source of truth; the visual view converts to/from
 * it with marked (md→html) and turndown (html→md), so anything the WYSIWYG
 * can't express you can still fix in the Markdown tab.
 */

marked.setOptions({ gfm: true });
const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

const mdToHtml = (md: string): string => String(marked.parse(md, { async: false }));
const htmlToMd = (html: string): string => turndown.turndown(html).trim();

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
  const editable = useRef<HTMLDivElement>(null);

  // Load the source into the visual surface whenever we (re)enter that tab.
  useEffect(() => {
    if (mode === "visual" && editable.current) {
      editable.current.innerHTML = mdToHtml(value) || "<p></p>";
    }
    // Only on tab switch: don't clobber the caret while the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const syncFromVisual = () => {
    if (editable.current) onChange(htmlToMd(editable.current.innerHTML));
  };

  /** Run a formatting command on the current selection, then sync. */
  const exec = (command: string, arg?: string) => {
    editable.current?.focus();
    document.execCommand(command, false, arg);
    syncFromVisual();
  };

  const toggleMode = (next: Mode) => {
    if (mode === "visual") syncFromVisual();
    setMode(next);
  };

  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="border-b border-line bg-surface px-1.5 py-1 text-xs">
        {/* Compact segmented switch: keeps room for the format buttons below. */}
        <div className="inline-flex rounded-md border border-line p-0.5">
          <Tab active={mode === "visual"} onClick={() => toggleMode("visual")}>
            Visueel
          </Tab>
          <Tab active={mode === "markdown"} onClick={() => toggleMode("markdown")}>
            MD
          </Tab>
        </div>
        {mode === "visual" && (
          <div className="mt-1 flex flex-wrap items-center gap-0.5">
            <Btn title="Bold" onClick={() => exec("bold")}>
              <strong>B</strong>
            </Btn>
            <Btn title="Italic" onClick={() => exec("italic")}>
              <em>I</em>
            </Btn>
            <Btn title="Heading" onClick={() => exec("formatBlock", "H2")}>
              H2
            </Btn>
            <Btn title="Subheading" onClick={() => exec("formatBlock", "H3")}>
              H3
            </Btn>
            <Btn title="Paragraph" onClick={() => exec("formatBlock", "P")}>
              ¶
            </Btn>
            <Btn title="Bulleted list" onClick={() => exec("insertUnorderedList")}>
              •
            </Btn>
            <Btn title="Numbered list" onClick={() => exec("insertOrderedList")}>
              1.
            </Btn>
            <Btn title="Quote" onClick={() => exec("formatBlock", "BLOCKQUOTE")}>
              ❝
            </Btn>
            <Btn
              title="Link"
              onClick={() => {
                const url = window.prompt("Link URL");
                if (url) exec("createLink", url);
              }}
            >
              🔗
            </Btn>
          </div>
        )}
      </div>

      {mode === "visual" ? (
        <div
          ref={editable}
          contentEditable
          suppressContentEditableWarning
          onInput={syncFromVisual}
          onBlur={syncFromVisual}
          className="markdown min-h-32 bg-background px-3 py-2 text-sm focus:outline-none"
        />
      ) : (
        <textarea
          className="block w-full resize-y bg-background px-2.5 py-1.5 font-mono text-sm focus:outline-none"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Markdown…"
        />
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-0.5 font-medium ${
        active ? "bg-accent text-background" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Btn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      // Keep the selection: prevent the button from stealing focus on mousedown.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded border border-line px-1.5 py-0.5 text-muted hover:border-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
