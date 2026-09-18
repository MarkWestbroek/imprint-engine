import "dotenv/config";
import { isDeepStrictEqual } from "node:util";
import mysql from "mysql2/promise";
import pg from "pg";

/**
 * Eenmalige verhuizing MariaDB → Postgres (deploy-vps.md §"MusicBrain
 * verhuizen"): kopieert content_items en users rij voor rij, met id's,
 * de hele bitemporale historie en de wachtwoordhashes. Beide schema's hebben
 * dezelfde kolomnamen; alleen de tijden vragen aandacht.
 *
 *   npm run db:copy-to-pg -- --from=mysql://… --to=postgres://… [--replace] [--dry-run]
 *
 * Tijden: MariaDB's DATETIME kent geen zone. De store schrijft en leest via
 * drizzle, en drizzle zet een Date altijd als UTC in DATETIME (en leest hem als
 * UTC terug) — ongeacht de tijdzone van het proces. De opgeslagen waarden zijn
 * dus UTC, lokaal én bij Quickhost. We lezen ze als tekst en interpreteren ze
 * in --tz (default UTC). Kale mysql2 zou ze als lokale tijd lezen en de hele
 * historie verschuiven; daarom `dateStrings`. Het script toont een steekproef.
 *
 * Doel: een gemigreerd (npm run db:migrate:pg) en leeg schema; met --replace
 * wordt het doel eerst geleegd. Alles in één Postgres-transactie, gevolgd door
 * een vergelijking rij voor rij; bij een verschil wordt teruggedraaid.
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  })
) as Record<string, string | true | undefined>;

const from = String(args.from ?? process.env.MARIADB_URL ?? "");
const to = String(args.to ?? process.env.DATABASE_URL ?? "");
const tz = String(args.tz ?? "UTC");
const replace = args.replace === true;
const dryRun = args["dry-run"] === true;

if (!/^mysql:/.test(from) || !/^postgres(ql)?:/.test(to)) {
  console.error("Gebruik: npm run db:copy-to-pg -- --from=mysql://… --to=postgres://… [--tz=UTC] [--replace] [--dry-run]");
  process.exit(1);
}

// Node herleest TZ bij toewijzing: vanaf hier is new Date(j, m, d, …) kloktijd in `tz`.
process.env.TZ = tz;

const DATE_COLS = ["valid_from", "valid_to", "tx_from", "tx_to"] as const;

/** "2026-07-22 19:07:43.341" (kloktijd in tz) → Date. */
function instant(s: string | null): Date | null {
  if (s === null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(s);
  if (!m) throw new Error(`onverwacht datumformaat: ${s}`);
  const [, y, mo, d, h, mi, sec, ms = "0"] = m;
  return new Date(+y, +mo - 1, +d, +h, +mi, +sec, +ms.padEnd(3, "0"));
}

type Content = {
  id: number; type: string; slug: string; lang: string; data: unknown;
  valid_from: Date; valid_to: Date | null; tx_from: Date; tx_to: Date | null; created_by: string | null;
};
type User = { id: number; name: string; hashed_password: string; role: string };

/** Zelfde vorm aan beide kanten, zodat de controle een deepEqual kan zijn. */
const norm = (r: Content) => ({
  ...r,
  id: Number(r.id),
  valid_from: r.valid_from.toISOString(),
  valid_to: r.valid_to?.toISOString() ?? null,
  tx_from: r.tx_from.toISOString(),
  tx_to: r.tx_to?.toISOString() ?? null,
});

async function readSource(): Promise<{ content: Content[]; users: User[] }> {
  const conn = await mysql.createConnection({ uri: from, dateStrings: true });
  try {
    const [c] = await conn.query("SELECT * FROM content_items ORDER BY id");
    const [u] = await conn.query("SELECT id, name, hashed_password, role FROM users ORDER BY id");
    const content = (c as Record<string, unknown>[]).map((r) => {
      const row = { ...r } as Record<string, unknown>;
      // MariaDB: JSON = LONGTEXT, dus een string.
      row.data = typeof r.data === "string" ? JSON.parse(r.data) : r.data;
      for (const col of DATE_COLS) row[col] = instant(r[col] as string | null);
      return row as unknown as Content;
    });
    return { content, users: u as User[] };
  } finally {
    await conn.end();
  }
}

async function main() {
  const src = await readSource();
  console.log(`bron   ${src.content.length} contentrijen, ${src.users.length} users (tijden gelezen als ${tz})`);
  const sample = src.content.at(-1);
  if (sample) console.log(`       steekproef: #${sample.id} ${sample.type}/${sample.slug} tx_from = ${sample.tx_from.toISOString()}`);

  const client = new pg.Client({ connectionString: to });
  await client.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ c: string; u: string }>(
      "SELECT (SELECT count(*) FROM content_items) AS c, (SELECT count(*) FROM users) AS u"
    );
    const { c, u } = existing.rows[0];
    if (Number(c) + Number(u) > 0) {
      if (!replace) throw new Error(`doel is niet leeg (${c} contentrijen, ${u} users) — gebruik --replace om het te overschrijven`);
      await client.query("TRUNCATE content_items, users RESTART IDENTITY");
      console.log(`doel   geleegd (${c} contentrijen, ${u} users)`);
    }

    for (const r of src.content) {
      await client.query(
        `INSERT INTO content_items (id, type, slug, lang, data, valid_from, valid_to, tx_from, tx_to, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)`,
        [r.id, r.type, r.slug, r.lang, JSON.stringify(r.data), r.valid_from, r.valid_to, r.tx_from, r.tx_to, r.created_by]
      );
    }
    for (const r of src.users) {
      await client.query(
        "INSERT INTO users (id, name, hashed_password, role) VALUES ($1, $2, $3, $4)",
        [r.id, r.name, r.hashed_password, r.role]
      );
    }
    // Nieuwe rijen na de kopie krijgen een id ná de overgenomen id's.
    for (const table of ["content_items", "users"]) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT max(id) FROM ${table}), 0) + 1, false)`
      );
    }

    // Controle: elke rij terug uit Postgres, gelijk aan de bron.
    const back = await client.query<Content>("SELECT * FROM content_items ORDER BY id");
    const backUsers = await client.query<User>("SELECT id, name, hashed_password, role FROM users ORDER BY id");
    const diffs = src.content.filter((r, i) => !back.rows[i] || !isDeepStrictEqual(norm(r), norm(back.rows[i])));
    const userDiffs = src.users.filter(
      (r, i) => !backUsers.rows[i] || !isDeepStrictEqual({ ...r, id: Number(r.id) }, { ...backUsers.rows[i], id: Number(backUsers.rows[i].id) })
    );
    if (back.rows.length !== src.content.length || diffs.length || backUsers.rows.length !== src.users.length || userDiffs.length) {
      throw new Error(
        `controle faalt: ${back.rows.length}/${src.content.length} contentrijen, ${diffs.length} verschillend` +
          (diffs[0] ? ` (eerste: #${diffs[0].id})` : "") +
          `; ${backUsers.rows.length}/${src.users.length} users, ${userDiffs.length} verschillend`
      );
    }

    const perType = new Map<string, [number, number]>();
    for (const r of src.content) {
      const [n, cur] = perType.get(r.type) ?? [0, 0];
      perType.set(r.type, [n + 1, cur + (r.tx_to === null ? 1 : 0)]);
    }
    for (const [type, [n, cur]] of [...perType].sort()) {
      console.log(`       ${type.padEnd(14)} ${String(n).padStart(4)} rijen, ${cur} actueel`);
    }

    if (dryRun) {
      await client.query("ROLLBACK");
      console.log("klaar  --dry-run: gecontroleerd en teruggedraaid, niets geschreven");
    } else {
      await client.query("COMMIT");
      console.log(`klaar  ${src.content.length} contentrijen en ${src.users.length} users gekopieerd en gecontroleerd`);
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
