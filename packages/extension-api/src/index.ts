import { createHash } from "node:crypto";
import path from "node:path";
import { toJSONSchema, type ZodType } from "zod";
import {
  ANONYMOUS,
  ContentTypeCatalog,
  ContentTypeRegistry,
  coreContentTypeDefinitions,
  DEFAULT_MEDIA_MAX_BYTES,
  type ContentTypeDefinition,
  type RelationRule,
  type WidgetTypeDef,
  FileAssetStore,
  type AssetStore,
  guardReads,
  inProcessPdp,
  type AuthzenSubject,
  type PolicyDecisionPoint,
  FileContentStore,
  WidgetTypeRegistry,
  type ContentStore,
  type ContentType,
  type WritableContentStore,
} from "@imprint/content-core";
import { dialectOf, openContentDatabase, type Dialect } from "@imprint/content-core/db";
import { S3AssetStore, type S3AssetConfig } from "@imprint/content-core/asset-store.s3";
import type { UserStore } from "@imprint/content-core/user-store";

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

/**
 * The React-free half of a plugin (design/fase-5 §3.2): what the composition
 * root merges into the instance. The admin half (screens, actions) is typed
 * in @imprint/runtime-admin (`ImprintPlugin`), which extends this.
 */
export interface ImprintPluginCore {
  name: string;
  version: string;
  contentTypes?: ContentTypeDefinition[];
  /** Widget config schemas; the site composes them into its catalogue (the React halves too). */
  widgets?: WidgetTypeDef[];
  /** Rules between types of different owners; a type's own rules sit on its definition. */
  relations?: RelationRule[];
  /** Admin menu items. */
  menu?: { group: string; label?: string; section?: string; adminOnly?: boolean; items: { href: string; label: string }[] }[];
}

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
  /**
   * The content types this site uses, out of those the model offers
   * (`CONTENT_TYPES`). Absent = all of them. Drives the admin and the write
   * API; the store itself holds whatever type it is given.
   */
  contentTypes?: ContentType[];
  /** Content types this site defines itself, on top of the core's (plugins bring theirs). */
  contentTypeDefinitions?: ContentTypeDefinition[];
  /** Plugins switched on for this instance (§6.3: trusted code, composed at build time). */
  plugins?: ImprintPluginCore[];
  /** The widget catalogue (config schemas) this instance supports; the store validates layouts against it. */
  widgets: WidgetTypeRegistry;
  /** Admin session cookie (rule 5: each instance its own cookie name). */
  session?: { cookie?: string; hours?: number };
  /**
   * Uploaded assets (board renders, the media library): where they live and
   * where they're served. With `s3` (all four fields set) they live in a
   * bucket — one per site (design/beeldbibliotheek.md §8) — else on disk
   * under `root`.
   */
  assets?: { root?: string; baseUrl?: string; s3?: Partial<S3AssetConfig> };
  /**
   * The media library (design/beeldbibliotheek.md): upload limits per file
   * kind, in bytes, and the origins that may call the media API (`/api/media`)
   * from a browser — e.g. `["https://editor.musicbrain.nl"]`.
   */
  media?: { maxBytes?: Partial<Record<string, number>>; cors?: string[] };
  /**
   * Secrets and outbound targets. The config file is the only place that reads
   * `process.env` for them, so shared code (the admin, Fase 3) never does.
   * All optional and never validated here: a bare checkout must build without
   * any of them, and each one fails or switches off where it is used.
   */
  secrets?: ImprintSecrets;
  /**
   * The policy decision point (design/fase-3 §4): absent = the fixed rule set
   * in the process (`inProcessPdp`), for dev, test and CI. Production plugs in
   * the HTTP adapter to the sidecar here.
   */
  pdp?: PolicyDecisionPoint;
}

export interface ImprintSecrets {
  /** Signs the admin session cookie. Absent = nobody can sign in. */
  session?: string;
  /** Bearer token for machine-to-machine writes (/api/content). Absent = writes off. */
  ingestToken?: string;
  /** HMAC secret of the GitHub release webhook. Absent = webhook off. */
  githubWebhook?: string;
  /** Publishing to another instance: its base URL and its ingest token. */
  publish?: { url?: string; token?: string };
}

export type StoreDialect = "file" | Dialect;

export interface ImprintInstance {
  id: string;
  dialect: StoreDialect;
  /**
   * Read side for public pages, as a visitor sees it: restricted content is
   * filtered out by the back-end PEP (`guardReads`), so nothing restricted can
   * reach prerendered HTML, a feed or an API answer.
   */
  store: ContentStore;
  /** The same read side for one subject (a signed-in member, the API with a session). */
  storeFor(subject: AuthzenSubject): ContentStore;
  /** The unguarded read side: what exists, regardless of who asks. Server-side only. */
  readStore: ContentStore;
  /** Write side for the admin; null in file mode (v0 content is edited in git). */
  writableStore: WritableContentStore | null;
  /** The decider; `permit()`/`guardReads()` from content-core are the enforcement points. */
  pdp: PolicyDecisionPoint;
  /** Users/roles for admin login; null in file mode (no database, no users). */
  users: UserStore | null;
  widgets: WidgetTypeRegistry;
  /** The active content types (design/fase-3 §7). */
  contentTypes: ContentTypeCatalog;
  /** The plugins, as configured; the admin reads their React half from the same objects. */
  plugins: ImprintPluginCore[];
  /** Disk or bucket (`assets.s3` in the config); the serving route reads through it either way. */
  assets: AssetStore;
  /** Upload limits per file kind (defaults from content-core, overridden by the config), and the API's allowed origins. */
  media: { maxBytes: Record<string, number>; cors: string[] };
  session: { cookie: string; hours: number };
  /** As configured; empty strings count as absent. */
  secrets: ImprintSecrets;
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
  checkPlugins(config.plugins ?? []);
  new ContentTypeCatalog(registryOf(config), config.contentTypes); // fail early on an unknown type
  if (config.session?.hours !== undefined && !(config.session.hours > 0)) {
    throw new Error(`imprint.config (${config.id}): session.hours must be positive`);
  }
  return config;
}

const PLUGIN_NAME_RE = /^[a-z][a-z0-9-]*$/;

/** Plugins are trusted code, but a configuration mistake should say so at startup, not at the first request. */
function checkPlugins(plugins: ImprintPluginCore[]): void {
  const seen = new Set<string>();
  for (const p of plugins) {
    if (!PLUGIN_NAME_RE.test(p.name)) throw new Error(`plugin name "${p.name}" must be lowercase letters, digits and dashes`);
    if (!p.version) throw new Error(`plugin "${p.name}" needs a version`);
    if (seen.has(p.name)) throw new Error(`plugin "${p.name}" is configured twice`);
    seen.add(p.name);
  }
}

/**
 * Every content type this instance knows: the core's, each plugin's, then the
 * site's own — built up plugin by plugin, so a clash names its owner.
 */
function registryOf(cfg: ImprintConfig): ContentTypeRegistry {
  const groups: ContentTypeDefinition[][] = [coreContentTypeDefinitions];
  for (const p of cfg.plugins ?? []) {
    const defs = p.contentTypes ?? [];
    for (const def of defs) {
      if (groups.flat().some((d) => d.name === def.name)) {
        throw new Error(`plugin "${p.name}" defines content type "${def.name}", which already exists`);
      }
    }
    groups.push(defs);
  }
  for (const def of cfg.contentTypeDefinitions ?? []) {
    if (groups.flat().some((d) => d.name === def.name)) {
      throw new Error(`site content type "${def.name}" already exists (core or a plugin)`);
    }
  }
  return ContentTypeRegistry.of(...groups, cfg.contentTypeDefinitions ?? []);
}

/** The bucket settings when all four are there (empty strings count as absent), else null: disk. */
function s3Config(s3: Partial<S3AssetConfig> | undefined): S3AssetConfig | null {
  if (!s3?.endpoint || !s3.bucket || !s3.accessKey || !s3.secretKey) return null;
  return { endpoint: s3.endpoint, bucket: s3.bucket, accessKey: s3.accessKey, secretKey: s3.secretKey, region: s3.region || undefined };
}

/** Build the live instance from a config. Uncached: every call opens its own pools. */
export function resolveImprint(config: ImprintConfig): ImprintInstance {
  const cfg = defineImprint(config);
  const widgets = cfg.widgets;
  const url = cfg.store.databaseUrl || undefined;

  const registry = registryOf(cfg);
  const opened = url ? openContentDatabase(url, { widgets, contentTypes: registry }) : null;
  const readStore: ContentStore =
    opened?.store ?? new FileContentStore(cfg.store.contentDir, { widgets });
  const pdp = cfg.pdp ?? inProcessPdp;

  const assetRoot = cfg.assets?.root || path.join(process.cwd(), ".assets");
  const assetBase = cfg.assets?.baseUrl || "/api/assets";

  return {
    id: cfg.id,
    dialect: opened?.dialect ?? "file",
    store: guardReads(readStore, ANONYMOUS, pdp),
    storeFor: (subject) => guardReads(readStore, subject, pdp),
    readStore,
    writableStore: opened?.store ?? null,
    pdp,
    users: opened?.users ?? null,
    widgets,
    contentTypes: new ContentTypeCatalog(registry, cfg.contentTypes),
    plugins: cfg.plugins ?? [],
    assets: s3Config(cfg.assets?.s3) ? new S3AssetStore(s3Config(cfg.assets?.s3)!, assetBase) : new FileAssetStore(assetRoot, assetBase),
    media: {
      maxBytes: { ...DEFAULT_MEDIA_MAX_BYTES, ...(cfg.media?.maxBytes as Record<string, number> | undefined) },
      // An origin is scheme + host (+ port), without a trailing slash: that is what the browser sends.
      cors: (cfg.media?.cors ?? []).map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean),
    },
    session: {
      cookie: cfg.session?.cookie || `imprint_${cfg.id}_session`,
      hours: cfg.session?.hours ?? 12,
    },
    secrets: {
      session: cfg.secrets?.session || undefined,
      ingestToken: cfg.secrets?.ingestToken || undefined,
      githubWebhook: cfg.secrets?.githubWebhook || undefined,
      publish: {
        url: cfg.secrets?.publish?.url || undefined,
        token: cfg.secrets?.publish?.token || undefined,
      },
    },
    close: () => (opened ? opened.close() : Promise.resolve()),
  };
}

function schemaPrint(schema: unknown): string {
  try {
    return JSON.stringify(toJSONSchema(schema as ZodType, { unrepresentable: "any" }));
  } catch {
    return "?";
  }
}

/**
 * What the instance is built from, as a short hash: the content types (names,
 * flags and schemas), which are active, the plugins and the widgets. Session
 * settings, secrets and URLs are left out: they do not change what the
 * registry and the stores validate against.
 */
export function fingerprintOf(config: ImprintConfig): string {
  const cfg = defineImprint(config);
  const shape = {
    types: registryOf(cfg)
      .definitions()
      .map((d) => [d.name, (d.flags ?? []).join(","), schemaPrint(d.schema)]),
    active: cfg.contentTypes ?? null,
    plugins: (cfg.plugins ?? []).map((p) => `${p.name}@${p.version}`),
    widgets: cfg.widgets.definitions().map((w) => [w.name, w.version ?? "", schemaPrint(w.configSchema)]),
  };
  return createHash("sha1").update(JSON.stringify(shape)).digest("hex").slice(0, 16);
}

/** How long a replaced instance stays open for requests that already hold it. */
const RETIRE_AFTER_MS = 60_000;

/**
 * The instance for this process, per config id and fingerprint. Next.js dev
 * re-evaluates modules on hot reload; caching on globalThis keeps a single
 * connection pool alive across those reloads. The key includes the
 * fingerprint, not the config object: Next may evaluate the config once per
 * layer (pages, route handlers), and those copies must share one instance.
 * When the fingerprint changes (a schema or content type was edited in dev),
 * a fresh instance is built and the old one is closed a minute later —
 * otherwise the running server would keep validating against the old model
 * until it is restarted.
 */
export function createImprint(config: ImprintConfig): ImprintInstance {
  const g = globalThis as unknown as { __imprintInstances?: Map<string, ImprintInstance> };
  const cache = (g.__imprintInstances ??= new Map());
  const key = `${config.id}#${fingerprintOf(config)}`;
  let instance = cache.get(key);
  if (!instance) {
    instance = resolveImprint(config);
    for (const [other, old] of cache) {
      if (other.startsWith(`${config.id}#`)) {
        cache.delete(other);
        setTimeout(() => void old.close().catch(() => {}), RETIRE_AFTER_MS).unref?.();
      }
    }
    cache.set(key, instance);
  }
  return instance;
}
