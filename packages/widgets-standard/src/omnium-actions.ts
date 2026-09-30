"use server";

import { fetchOmniumViews, omniumBaseUrl, type OmniumViews } from "./omnium";

/**
 * Server action for the studio's v3model editor: which diagrams and domains a
 * model in Omnium offers. It only reads Omnium's public `views.json` on the
 * site's own `OMNIUM_URL` (the name is URL-encoded into a fixed path), so it
 * is no general-purpose fetch proxy.
 */
export async function omniumViewsAction(naam: string, versie?: string, asOf?: string): Promise<OmniumViews | { error: string }> {
  const base = omniumBaseUrl();
  if (!base) return { error: "This site has no Omnium connection (OMNIUM_URL)." };
  if (!naam.trim()) return { diagrammen: [], domeinen: [] };
  return fetchOmniumViews(base, naam.trim(), versie?.trim() || undefined, asOf?.trim() || undefined);
}
