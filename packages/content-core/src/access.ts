import type { Access, RoleType } from "./schemas";
import type { ContentRecord, ContentStore, ContentType, WritableContentStore } from "./store";

/**
 * Access control — the PEP/PDP pair in AuthZEN form (design/fase-3 §4).
 *
 * The shapes below are the OpenID AuthZEN Authorization API 1.0 request and
 * response: subject, action, resource, context → decision. Imprint standardises
 * on that contract, not on a policy language, so the decider is pluggable:
 * today `inProcessPdp` (the fixed rule set, for dev, test and CI), later an
 * HTTP adapter to the OpenFTV sidecar — without touching a single call site.
 *
 * Two rules the whole design leans on:
 *  - public content never asks the PDP (no dependency on it, may be prerendered);
 *  - a PDP that fails to answer is a "no" for restricted content and for writes.
 */

// ---------- AuthZEN 1.0 shapes ----------

export type AuthzenSubject = { type: string; id: string; properties?: Record<string, unknown> };
export type AuthzenAction = { name: string; properties?: Record<string, unknown> };
export type AuthzenResource = { type: string; id: string; properties?: Record<string, unknown> };

export interface EvaluationRequest {
  subject: AuthzenSubject;
  action: AuthzenAction;
  resource: AuthzenResource;
  context?: Record<string, unknown>;
}

export interface EvaluationResponse {
  decision: boolean;
  /** Free-form; a reason for the log, never input for logic. */
  context?: Record<string, unknown>;
}

export interface PolicyDecisionPoint {
  evaluate(request: EvaluationRequest): Promise<EvaluationResponse>;
  /** AuthZEN "evaluations": one call for a list (a menu, a filtered list). Same order. */
  evaluations(requests: EvaluationRequest[]): Promise<EvaluationResponse[]>;
}

// ---------- subjects, actions, resources as Imprint builds them ----------

export type ContentAction = "read" | "create" | "update" | "delete";

export const ANONYMOUS: AuthzenSubject = { type: "visitor", id: "anonymous" };

export function userSubject(name: string, role: RoleType): AuthzenSubject {
  return { type: "user", id: name, properties: { role } };
}

export function roleOf(subject: AuthzenSubject): RoleType | undefined {
  const role = subject.properties?.role;
  return role === "admin" || role === "editor" || role === "reader" ? role : undefined;
}

/** The access value of a stored item; anything without one is public. */
export function accessOf(data: unknown): Access {
  return (data as { access?: unknown } | null)?.access === "restricted" ? "restricted" : "public";
}

export function contentResource(type: string, id: string, data?: unknown): AuthzenResource {
  return { type, id, properties: { access: accessOf(data) } };
}

// ---------- the in-process decider ----------

/**
 * The fixed rule set, in one place behind the interface:
 *  1. admin may do anything;
 *  2. editor may create, update and delete content (delete is a tombstone,
 *     restorable from History, so it counts as editing);
 *  3. anyone signed in, readers included, may read anything;
 *  4. a visitor may read public content only.
 */
export const inProcessPdp: PolicyDecisionPoint = {
  async evaluate({ subject, action, resource }): Promise<EvaluationResponse> {
    const role = roleOf(subject);
    if (role === "admin") return { decision: true, context: { reason: "admin" } };
    if (role === "editor") return { decision: true, context: { reason: "editor" } };
    if (action.name === "read") {
      if (role === "reader") return { decision: true, context: { reason: "reader" } };
      return resource.properties?.access !== "restricted"
        ? { decision: true, context: { reason: "public" } }
        : { decision: false, context: { reason: "restricted" } };
    }
    return { decision: false, context: { reason: role ? `${role} may not write` : "not signed in" } };
  },
  evaluations(requests) {
    return Promise.all(requests.map((request) => this.evaluate(request)));
  },
};

// ---------- the PEP ----------

/**
 * One question, one answer. Public reads never reach the PDP; everything else
 * does, and a PDP that throws (unreachable, malformed) answers "no".
 */
export async function permit(
  pdp: PolicyDecisionPoint,
  subject: AuthzenSubject,
  action: ContentAction,
  resource: AuthzenResource,
  context?: Record<string, unknown>
): Promise<boolean> {
  if (action === "read" && resource.properties?.access !== "restricted") return true;
  try {
    return (await pdp.evaluate({ subject, action: { name: action }, resource, context })).decision;
  } catch {
    return false;
  }
}

/** Keep the items of `list` the subject may read; public ones stay without asking. */
export async function permitted<T>(
  pdp: PolicyDecisionPoint,
  subject: AuthzenSubject,
  type: string,
  list: T[],
  idOf: (item: T) => string
): Promise<T[]> {
  const restricted = list.filter((item) => accessOf(item) === "restricted");
  if (restricted.length === 0) return list;
  let answers: EvaluationResponse[];
  try {
    answers = await pdp.evaluations(
      restricted.map((item) => ({
        subject,
        action: { name: "read" },
        resource: contentResource(type, idOf(item), item),
      }))
    );
  } catch {
    answers = [];
  }
  const allowed = new Set(restricted.filter((_, i) => answers[i]?.decision === true));
  return list.filter((item) => accessOf(item) === "public" || allowed.has(item));
}

// ---------- the PEP around a store (the back-end side) ----------

/**
 * The read side of a store as one subject may see it: restricted items are
 * dropped from every list and `null` for every get unless the PDP allows them.
 * This is the back-end PEP of the design (§4.2) for the database backends;
 * the register brings its own. Wrap the visitor's store with `ANONYMOUS` and
 * nothing restricted can end up in prerendered HTML, a feed or an API answer.
 *
 * Also covers `listItems`/`getItem` when given a writable store (widgets read
 * raw items through those), so a restricted planning card stays off a public
 * board. Writes are not wrapped: that is the front-end PEP's job.
 */
export function guardReads<S extends ContentStore>(store: S, subject: AuthzenSubject, pdp: PolicyDecisionPoint): S {
  const list = <T>(type: string, items: T[], idOf: (item: T) => string) =>
    permitted(pdp, subject, type, items, idOf);
  const one = async <T>(type: string, item: T | null, idOf: (item: T) => string): Promise<T | null> =>
    item && (await permit(pdp, subject, "read", contentResource(type, idOf(item), item))) ? item : null;

  const slug = (item: { slug: string }) => item.slug;
  const releaseId = (r: { project: string; version: string }) => `${r.project}-${r.version}`;
  const guarded: ContentStore = {
    getSiteConfig: (opts) => store.getSiteConfig(opts),
    listProducts: async (opts) => list("product", await store.listProducts(opts), slug),
    getProduct: async (s, opts) => one("product", await store.getProduct(s, opts), slug),
    listReleases: async (opts) => list("release", await store.listReleases(opts), releaseId),
    listComponents: async (opts) => list("component", await store.listComponents(opts), slug),
    getComponent: async (s, opts) => one("component", await store.getComponent(s, opts), slug),
    listBoardSpecs: async (opts) => list("board-spec", await store.listBoardSpecs(opts), slug),
    getBoardSpec: async (s, opts) => one("board-spec", await store.getBoardSpec(s, opts), slug),
    listPages: async (opts) => list("page", await store.listPages(opts), slug),
    getPage: async (s, opts) => one("page", await store.getPage(s, opts), slug),
    getMenu: (name, opts) => store.getMenu(name, opts),
    listThemes: (opts) => store.listThemes(opts),
  };

  const writable = store as unknown as Partial<WritableContentStore>;
  if (typeof writable.listItems === "function" && typeof writable.getItem === "function") {
    const recordId = (r: ContentRecord) => r.slug;
    const dataOf = (r: ContentRecord) => r.data;
    Object.assign(guarded, {
      listItems: async (type: ContentType) => {
        const items = await writable.listItems!(type);
        const keep = await permitted(pdp, subject, type, items.map(dataOf), (d) => String((d as { slug?: string }).slug ?? ""));
        const allowed = new Set(keep);
        return items.filter((r) => allowed.has(r.data));
      },
      getItem: async (type: ContentType, s: string, lang?: string) => {
        const item = await writable.getItem!(type, s, lang);
        return item && (await permit(pdp, subject, "read", contentResource(type, recordId(item), item.data)))
          ? item
          : null;
      },
    });
  }
  // Everything else (writes, listVersions) resolves through the prototype chain
  // to the original store, which stays `this` for its own methods.
  return Object.assign(Object.create(store as object), guarded) as S;
}
