import {
  ANONYMOUS,
  contentResource,
  permit,
  userSubject,
  type AuthzenSubject,
  type ContentAction,
} from "@imprint/content-core";
import { imprint } from "@/lib/content";
import type { Session } from "./auth";

/**
 * The front-end PEP (design/fase-3 §4.2): the one gate every decision in this
 * site goes through before something is shown or written. It decides nothing
 * itself — it turns session + action + resource into an AuthZEN evaluation
 * request and asks the instance's PDP (`imprint.pdp`: the in-process rule set,
 * or the sidecar adapter in production). `permit()` in content-core holds the
 * two invariants: public reads never ask, and a PDP that fails answers "no".
 *
 * Asynchronous on purpose, so the sidecar fits without touching call sites.
 * The back-end PEP — restricted items dropped from every read — is the guarded
 * store (`imprint.store`, `imprint.storeFor`), not this function.
 */

/** The AuthZEN subject for a session, or the visitor. */
export function subjectOf(session: Session | null): AuthzenSubject {
  return session ? userSubject(session.name, session.role) : ANONYMOUS;
}

export async function authorize(
  session: Session | null,
  action: ContentAction,
  resource: { type: string; id: string; data?: unknown },
  context?: Record<string, unknown>
): Promise<boolean> {
  return permit(
    imprint.pdp,
    subjectOf(session),
    action,
    contentResource(resource.type, resource.id, resource.data),
    context
  );
}
