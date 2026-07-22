import type { RoleType } from "@imprint/content-core";
import type { Session } from "./auth";

/**
 * Autorisatie — het PEP/PDP-paar (design/wiki.md §4).
 *
 * `authorize()` is het **Policy Enforcement Point**: het ene poortje waar
 * elke lees/schrijf-beslissing doorheen gaat. Het beslist zelf niets; het
 * vertaalt sessie + handeling + resource naar een `DecisionRequest` en
 * vraagt de **Policy Decision Point** om een besluit.
 *
 * De PDP is bewust een interface (het AuthZEN-snijvlak): we standaardiseren
 * op het contract tussen PEP en PDP, niet op een policytaal. Vandaag beslist
 * `staticPdp` (de vaste regelset); later kan een policies-als-content-PDP of
 * een ODRL-gebaseerde taal inpluggen zonder dat call-sites veranderen.
 */

export type Action = "read" | "create" | "update" | "delete";

export interface ResourceRef {
  /** Content type ("page", "wiki-page", …) of "*" voor een generieke check. */
  type: string;
  slug?: string;
  /** Leesbaarheid voor niet-ingelogden; default "public". */
  visibility?: "public" | "members";
  /** Wiki-slug als de resource in een wiki leeft (voor latere overerving). */
  wiki?: string;
}

export interface DecisionRequest {
  subject: { role?: RoleType; name?: string; attrs?: Record<string, string> };
  action: Action;
  resource: ResourceRef;
  context?: Record<string, unknown>;
}

export interface Decision {
  allow: boolean;
  /** Korte motivering — voor logging/audit, nooit voor de beslislogica. */
  reason?: string;
}

export interface PolicyDecisionPoint {
  decide(req: DecisionRequest): Decision;
}

/**
 * De vaste regelset (PDP #1). Bewust simpel en hardgecodeerd — maar op één
 * plek, achter het interface:
 *  1. admin mag alles;
 *  2. editor mag content maken en bewerken (delete is hier een tombstone —
 *     herstelbaar via History — en telt als bewerken);
 *  3. reader (ingelogd) mag alles lezen;
 *  4. publiek mag alleen lezen wat `visibility: "public"` heeft.
 */
export const staticPdp: PolicyDecisionPoint = {
  decide({ subject, action, resource }): Decision {
    if (subject.role === "admin") return { allow: true, reason: "admin" };
    if (subject.role === "editor") return { allow: true, reason: "editor" };
    if (action === "read") {
      if (subject.role === "reader") return { allow: true, reason: "reader" };
      return (resource.visibility ?? "public") === "public"
        ? { allow: true, reason: "public" }
        : { allow: false, reason: "members-only" };
    }
    return {
      allow: false,
      reason: subject.role ? `role "${subject.role}" may not write` : "not signed in",
    };
  },
};

/** De actieve beslisser; verwisselbaar (module-import, geen sidecar — Plesk-proof). */
const pdp: PolicyDecisionPoint = staticPdp;

/** Het PEP: één vraag, één antwoord. Alle checks horen hierdoorheen. */
export function authorize(
  session: Session | null,
  action: Action,
  resource: ResourceRef,
  context?: Record<string, unknown>
): boolean {
  return pdp.decide({
    subject: session ? { role: session.role, name: session.name } : {},
    action,
    resource,
    context,
  }).allow;
}
