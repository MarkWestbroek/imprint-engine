import { promises as fs } from "node:fs";
import path from "node:path";
import type { SearchStats } from "@imprint/content-core/user-store";
import type { AdminContext } from "../admin-context";
import { StatsView } from "../admin/stats-view";

/**
 * `/admin/stats` (core; reached through the site's `[type]` route, so every
 * site has it): what visitors searched for, from the site's own search log,
 * and the visits report GoAccess makes from the web server's access log
 * (deploy/vps/stats.sh), when the instance is told where it is
 * (`stats.reportDir` in imprint.config.ts). Machines are counted, not listed.
 */
export async function StatsScreen({ admin }: { admin: AdminContext }) {
  const users = admin.imprint.users;
  const now = Date.now();
  const periods: { label: string; days: number }[] = [
    { label: "Afgelopen 7 dagen", days: 7 },
    { label: "Afgelopen 30 dagen", days: 30 },
    { label: "Afgelopen jaar", days: 365 },
  ];
  const searches: { label: string; stats: SearchStats }[] = users
    ? await Promise.all(periods.map(async (p) => ({ label: p.label, stats: await users.searchStats(new Date(now - p.days * 864e5)) })))
    : [];
  const report = await readReport(admin.imprint.stats.reportDir);
  const site = await admin.imprint.store.getSiteConfig();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Statistieken{site.name ? <span className="hidden print:inline"> · {site.name}</span> : null}</h1>
      <StatsView
        searches={searches.map((s, i) => ({ label: s.label, days: periods[i]!.days, stats: { ...s.stats, since: s.stats.since.toISOString() } }))}
        report={report}
        site={admin.imprint.id}
      />
    </div>
  );
}

type Report = { html: string; updated: string } | { missing: string };

async function readReport(dir: string | null): Promise<Report> {
  if (!dir) return { missing: "Er is geen bezoekrapport ingesteld voor deze site (stats.reportDir)." };
  const file = path.join(dir, "index.html");
  try {
    const [html, stat] = await Promise.all([fs.readFile(file, "utf8"), fs.stat(file)]);
    return { html, updated: stat.mtime.toISOString() };
  } catch {
    return { missing: "Het bezoekrapport is er nog niet; het wordt elk uur bijgewerkt uit het toegangslog van de webserver." };
  }
}
