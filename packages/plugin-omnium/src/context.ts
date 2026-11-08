import { cache } from "react";
import { OmniumRegister, registerConfigFromEnv, type ReadMoment } from "./client";
import { Inrichting, type Located } from "./inrichting";

/**
 * One `Inrichting` per request and moment (React `cache`): the page and every
 * widget on it share the lists they load. Null when the site has no register.
 */
export const inrichtingFor = cache((prefix: string, peiltijdstip?: string, geldigOp?: string): Inrichting | null => {
  const config = registerConfigFromEnv();
  if (!config) return null;
  const at: ReadMoment = { peiltijdstip, geldigOp };
  return new Inrichting(new OmniumRegister(config), prefix, at);
});

/** What a `_view/omnium-<pad>` template gets as subject. */
export type OmniumSubject = Located & { omnium: true; prefix: string; at: ReadMoment; element?: string; veld?: string };

export function isOmniumSubject(s: unknown): s is OmniumSubject {
  return Boolean(s && typeof s === "object" && (s as { omnium?: unknown }).omnium === true);
}

/** The Inrichting for a widget: the page's (same moment), else the current state under the default prefix. */
export function inrichtingOf(subject: unknown, prefix = "/inrichting"): Inrichting | null {
  if (isOmniumSubject(subject)) return inrichtingFor(subject.prefix, subject.at.peiltijdstip, subject.at.geldigOp);
  return inrichtingFor(prefix);
}
