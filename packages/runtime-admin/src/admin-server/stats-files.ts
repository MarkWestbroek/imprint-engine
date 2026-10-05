import { promises as fs } from "node:fs";
import path from "node:path";
import type { AdminContext } from "../admin-context";

/**
 * The statistics as files, under the asset route every site already mounts
 * (`/api/assets/_stats/…`, like `_ref`; no slug has a `_`), so no site needs
 * a route of its own. For people who edit the site only.
 *
 * - `_stats/visits`: the GoAccess report on its own, to print or save as PDF.
 *   Served with `Content-Security-Policy: sandbox`, so its scripts run in an
 *   origin of their own and reach nothing of the admin (the report is made
 *   from the access log, whose contents a visitor chooses).
 * - `_stats/searches.csv?days=N`: the searches people typed, for Excel
 *   (semicolons, a BOM; a cell that starts like a formula is defused).
 */
export async function statsFile(admin: AdminContext, req: Request, name: string): Promise<Response> {
  if (!(await admin.auth.editingSession())) return new Response("Not found", { status: 404 });
  if (name === "visits") return visits(admin);
  if (name === "searches.csv") return searchesCsv(admin, req);
  return new Response("Not found", { status: 404 });
}

async function visits(admin: AdminContext): Promise<Response> {
  const dir = admin.imprint.stats.reportDir;
  if (!dir) return new Response("Geen bezoekrapport ingesteld", { status: 404 });
  try {
    const html = await fs.readFile(path.join(dir, "index.html"));
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "sandbox allow-scripts allow-modals",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch {
    return new Response("Het bezoekrapport is er nog niet", { status: 404 });
  }
}

/**
 * The moment as a file name starts: "2026-10-05 16u09", Dutch time. Sorts by
 * date, reads as Dutch, and has no colon (Windows forbids it; ISO 8601's
 * "16:09" is therefore out).
 */
export function fileStamp(at: Date, timeZone = "Europe/Amsterdam"): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}u${parts.minute}`;
}

/** A cell for a spreadsheet: quoted, and never read as a formula. */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) || s !== String(value) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function searchesCsv(admin: AdminContext, req: Request): Promise<Response> {
  const users = admin.imprint.users;
  if (!users) return new Response("Geen database", { status: 404 });
  const days = Math.min(400, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 30));
  const stats = await users.searchStats(new Date(Date.now() - days * 864e5), 100000);
  const lines = [["zoekterm", "aantal", "resultaten"].join(";"), ...stats.terms.map((t) => [csvCell(t.term), t.count, t.hits].join(";"))];
  const name = `${fileStamp(new Date())} zoekopdrachten ${admin.imprint.id} ${days}d.csv`;
  // A byte-order mark first: Excel then reads the file as UTF-8.
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
