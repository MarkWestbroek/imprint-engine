import type { ContentStore } from "@imprint/content-core";
import { createImprint } from "@imprint/extension-api";
import config from "../../imprint.config";

/**
 * Composition root of the Imprint product site (architecture.md §0): the
 * instance comes from `imprint.config.ts`; DATABASE_URL decides the backend
 * (Postgres here), and without a URL the site falls back to its own
 * `content/` folder. The rest of the site only ever sees `ContentStore`.
 */
export const imprint = createImprint(config);

export const store: ContentStore = imprint.store;
