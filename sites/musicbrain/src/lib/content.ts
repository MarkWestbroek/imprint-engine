import path from "node:path";
import { FileContentStore, type ContentStore } from "@cms2026/content-core";

/**
 * The one place the site talks to content (S1). Swap this for a
 * database-backed store later without touching any page code.
 */
export const store: ContentStore = new FileContentStore(
  path.join(process.cwd(), "content")
);
