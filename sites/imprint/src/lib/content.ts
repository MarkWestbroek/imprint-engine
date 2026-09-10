import path from "node:path";
import { FileContentStore, type ContentStore } from "@imprint/content-core";
import { openContentDatabase, type OpenedContentDatabase } from "@imprint/content-core/db";

/**
 * Composition root of the Imprint product site (architecture.md §0): the one
 * place that picks a backend. DATABASE_URL decides the dialect — this site
 * runs on Postgres (`postgres://…`), MusicBrain on MariaDB — and without a
 * URL the site falls back to its own `content/` folder, so a bare checkout
 * (and CI) still builds. The rest of the site only ever sees `ContentStore`.
 */
const url = process.env.DATABASE_URL;

// Dev hot-reload re-evaluates modules; keep one connection pool per process.
const globalForDb = globalThis as unknown as { __imprintProductDb?: OpenedContentDatabase };
const opened: OpenedContentDatabase | null = url
  ? (globalForDb.__imprintProductDb ??= openContentDatabase(url))
  : null;

export const store: ContentStore =
  opened?.store ?? new FileContentStore(path.join(process.cwd(), "content"));
