import path from "node:path";
import {
  FileAssetStore,
  FileContentStore,
  WidgetTypeRegistry,
  type ContentStore,
  type WritableContentStore,
} from "@imprint/content-core";
import { dialectOf, openContentDatabase, type Dialect } from "@imprint/content-core/db";
import type { DbUserStore } from "@imprint/content-core/user-store";

/**
 * The composition root of an Imprint instance (architecture.md §0, Fase 1 of
 * the revision proposal). A site describes itself once, in `imprint.config.ts`,
 * with `defineImprint()`; `createImprint()` turns that description into the
 * live objects (store, users, assets, widget registry) that the rest of the
 * site — and, in later phases, the shared runtime and admin — receive from
 * here instead of importing site-global modules.
 *
 * Deliberately framework-free: no React, no Next. SiteChrome, viewers and
 * editors stay in the site until the renderer/admin extraction (Fase 2–4)
 * gives them a typed slot here.
 */

export interface ImprintConfig {
  /** Stable instance id, e.g. "musicbrain". Names the per-process singleton and later per-instance namespaces. */
  id: string;
  store: {
    /**
     * `mysql://…` (MariaDB) or `postgres://…` — the scheme picks the backend.
     * Empty/absent = the file store on `contentDir`, so a bare checkout builds.
     */
    databaseUrl?: string;
    /** The v0 content folder: file-store fallback and seed source. */
    contentDir: string;
  };
  /** The widget catalogue (config schemas) this instance supports; the store validates layouts against it. */
  widgets: WidgetTypeRegistry;
  /** Admin session cookie (rule 5: each instance its own cookie name). */
  session?: { cookie?: string; hours?: number };
  /** Uploaded assets (board renders, pinouts): where they live and where they're served. */
  assets?: { root?: string; baseUrl?: string };
}

export type StoreDialect = "file" | Dialect;

export interface ImprintInstance {
  id: string;
  dialect: StoreDialect;
  /** Read side for public pages. */
  store: ContentStore;
  /** Write side for the admin; null in file mode (v0 content is edited in git). */
  writableStore: WritableContentStore | null;
  /** Users/roles for admin login; null in file mode and, for now, on Postgres (backlog). */
  users: DbUserStore | null;
  widgets: WidgetTypeRegistry;
  /**
   * Typed as the file backend on purpose: it is the only one, and the route
   * that serves assets needs `resolve()`. An S3/MinIO backend later means a
   * config switch here plus a backend-specific serving route.
   */
  assets: FileAssetStore;
  session: { cookie: string; hours: number };
  /** Release connection pools (CLI/tests; a running site never calls this). */
  close(): Promise<void>;
}

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/** Validate and return a site's configuration. Pure: opens nothing. */
export function defineImprint(config: ImprintConfig): ImprintConfig {
  if (!ID_RE.test(config.id)) {
    throw new Error(`imprint.config: id "${config.id}" must be lowercase letters, digits and dashes`);
  }
  if (!config.store?.contentDir) {
    throw new Error(`imprint.config (${config.id}): store.contentDir is required`);
  }
  if (config.store.databaseUrl) dialectOf(config.store.databaseUrl); // fail early on a bad scheme
  if (!(config.widgets instanceof WidgetTypeRegistry)) {
    throw new Error(`imprint.config (${config.id}): widgets must be a WidgetTypeRegistry`);
  }
  if (config.session?.hours !== undefined && !(config.session.hours > 0)) {
    throw new Error(`imprint.config (${config.id}): session.hours must be positive`);
  }
  return config;
}

/** Build the live instance from a config. Uncached: every call opens its own pools. */
export function resolveImprint(config: ImprintConfig): ImprintInstance {
  const cfg = defineImprint(config);
  const widgets = cfg.widgets;
  const url = cfg.store.databaseUrl || undefined;

  const opened = url ? openContentDatabase(url, { widgets }) : null;
  const store: ContentStore =
    opened?.store ?? new FileContentStore(cfg.store.contentDir, { widgets });

  const assetRoot = cfg.assets?.root || path.join(process.cwd(), ".assets");
  const assetBase = cfg.assets?.baseUrl || "/api/assets";

  return {
    id: cfg.id,
    dialect: opened?.dialect ?? "file",
    store,
    writableStore: opened?.store ?? null,
    users: opened?.users ?? null,
    widgets,
    assets: new FileAssetStore(assetRoot, assetBase),
    session: {
      cookie: cfg.session?.cookie || `imprint_${cfg.id}_session`,
      hours: cfg.session?.hours ?? 12,
    },
    close: () => (opened ? opened.close() : Promise.resolve()),
  };
}

/**
 * The instance for this process, one per config id. Next.js dev re-evaluates
 * modules on hot reload; caching on globalThis keeps a single connection pool
 * alive across those reloads (the same trick the sites used before).
 */
export function createImprint(config: ImprintConfig): ImprintInstance {
  const g = globalThis as unknown as { __imprintInstances?: Map<string, ImprintInstance> };
  const cache = (g.__imprintInstances ??= new Map());
  let instance = cache.get(config.id);
  if (!instance) {
    instance = resolveImprint(config);
    cache.set(config.id, instance);
  }
  return instance;
}
