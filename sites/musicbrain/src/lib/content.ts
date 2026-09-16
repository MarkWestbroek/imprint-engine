import type { ContentStore, WritableContentStore } from "@imprint/content-core";
import { createImprint } from "@imprint/extension-api";
import config from "../../imprint.config";

/**
 * The one place the site talks to content (S1). The instance comes from
 * `imprint.config.ts` (architecture.md §0): with DATABASE_URL set it runs on
 * the database backend the URL names (MariaDB here); without it, on the
 * file-backed store — so a checkout still builds with no DB.
 */
export const imprint = createImprint(config);

export const store: ContentStore = imprint.store;

/** Write access for /admin. Null in file mode: v0 content is edited in git. */
export const writableStore: WritableContentStore | null = imprint.writableStore;
