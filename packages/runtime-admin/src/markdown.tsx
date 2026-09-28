import type { ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { assetRefUrl } from "./media/ref";

/** URL-safe id from heading text: "Zo werkt het (2)" → "zo-werkt-het-2". */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

// Headings get an id from their text, so a table of contents and anchor links work.
const heading =
  (Tag: "h1" | "h2" | "h3" | "h4") =>
  ({ children }: { children?: ReactNode }) => <Tag id={headingId(textOf(children))}>{children}</Tag>;

const components: Components = { h1: heading("h1"), h2: heading("h2"), h3: heading("h3"), h4: heading("h4") };

/** Markdown links and images: `asset:<slug>` goes through the ref route, the rest through the default (safe) transform. */
export function markdownUrl(url: string): string {
  return assetRefUrl(url) ?? defaultUrlTransform(url);
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={markdownUrl}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
