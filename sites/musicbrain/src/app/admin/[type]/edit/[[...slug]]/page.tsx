import Link from "next/link";
import { notFound } from "next/navigation";
import type { ContentType } from "@imprint/content-core";
import { writableStore } from "@/lib/content";
import { contentFormSchema, widgetFormSchemas } from "@/lib/admin-schemas";
import { ItemEditor } from "@/components/admin/item-editor";
import { TEMPLATES } from "@/widgets/templates";

const CONTENT_TYPES: ContentType[] = ["site", "product", "release", "page", "menu"];

type Props = {
  params: Promise<{ type: string; slug?: string[] }>;
  searchParams: Promise<{ lang?: string }>;
};

/** Sensible starting data for a new item, so required fields are visible. */
function emptyData(type: ContentType): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10);
  switch (type) {
    case "site":
      return { name: "", tagline: "", baseUrl: "https://", defaultLocale: "en", links: {} };
    case "product":
      return { slug: "", lang: "en", name: "", tagline: "", status: "in-development", description: "", specs: [], media: [], order: 0 };
    case "release":
      return { project: "", version: "", date: today, channel: "stable", highlights: [], body: "", downloads: [] };
    case "menu":
      return { name: "", items: [] };
    case "page":
      return { slug: "", lang: "en", title: "", description: "", draft: false, body: "" };
  }
}

/** Date → value for <input type="datetime-local"> (minute precision). */
function toLocalInput(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default async function AdminEdit({ params, searchParams }: Props) {
  const { type, slug: slugParts } = await params;
  const { lang } = await searchParams;
  if (!CONTENT_TYPES.includes(type as ContentType)) notFound();
  const contentType = type as ContentType;

  const slug = slugParts?.map(decodeURIComponent).join("/");
  const item = slug
    ? await writableStore!.getItem(contentType, slug, lang ?? "en")
    : null;
  if (slug && !item) notFound();

  const templates = Object.fromEntries(
    Object.entries(TEMPLATES).map(([name, t]) => [name, { regions: t.regions }])
  );

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-muted">
        <Link href={`/admin/${type}`} className="hover:text-foreground">
          ← {type}s
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {item ? `Edit ${type}: ${slug}` : `New ${type}`}
      </h1>
      <div className="mt-6">
        <ItemEditor
          type={contentType}
          initialData={(item?.data as Record<string, unknown>) ?? emptyData(contentType)}
          formSchema={contentFormSchema(contentType)}
          isNew={!item}
          validFrom={toLocalInput(item?.validFrom)}
          validTo={toLocalInput(item?.validTo)}
          templates={templates}
          widgetSchemas={contentType === "page" ? widgetFormSchemas() : undefined}
        />
      </div>
    </div>
  );
}
