import Link from "next/link";
import { notFound } from "next/navigation";
import type { ContentType } from "@imprint/content-core";
import { writableStore } from "@/lib/content";
import { contentFormSchema } from "@/lib/admin-schemas";
import { ItemEditor } from "@/components/admin/item-editor";
import { PageStudio } from "@/components/admin/studio";

const CONTENT_TYPES: ContentType[] = ["site", "product", "component", "board-spec", "release", "page", "menu"];

type Props = {
  params: Promise<{ type: string; slug?: string[] }>;
  searchParams: Promise<{ lang?: string; previewAs?: string }>;
};

/** Sensible starting data for a new item, so required fields are visible. */
function emptyData(type: ContentType): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10);
  switch (type) {
    case "site":
      return { name: "", tagline: "", baseUrl: "https://", defaultLocale: "en", links: {} };
    case "product":
      return { slug: "", lang: "en", name: "", tagline: "", status: "in-development", description: "", specs: [], media: [], components: [], order: 0 };
    case "component":
      return { slug: "", lang: "en", name: "", description: "", children: [], versions: [] };
    case "board-spec":
      return { slug: "", lang: "en", component: "", version: "", connectors: [], assets: { pinouts: {} }, sections: [], related: [] };
    case "release":
      return { project: "", version: "", date: today, channel: "stable", highlights: [], body: "", downloads: [] };
    case "menu":
      return { name: "", items: [] };
    case "page":
      return {};
    case "relations":
      return { rules: [] };
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
  const { lang, previewAs } = await searchParams;
  if (!CONTENT_TYPES.includes(type as ContentType)) notFound();
  const contentType = type as ContentType;
  const slug = slugParts?.map(decodeURIComponent).join("/");

  // Pages get the visual studio (live canvas + sidebar), the rest a form.
  if (contentType === "page") {
    return <PageStudio slug={slug} lang={lang ?? "en"} previewAs={previewAs} />;
  }

  const item = slug
    ? await writableStore!.getItem(contentType, slug, lang ?? "en")
    : null;
  if (slug && !item) notFound();

  // Menu items point to pages; give the editor the real list to pick from.
  const pages =
    contentType === "menu"
      ? (await writableStore!.listItems("page")).map((p) => ({
          slug: p.slug,
          title: String((p.data as Record<string, unknown>).title ?? p.slug),
        }))
      : undefined;

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
          pages={pages}
        />
      </div>
    </div>
  );
}
