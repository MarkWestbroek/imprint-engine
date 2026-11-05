import Link from "next/link";
import type { ReactNode } from "react";
import { WidgetFrame, type WidgetContext, type WidgetViewers } from "@imprint/runtime-admin";
import { registerProblem } from "./client";
import { inrichtingOf, isOmniumSubject } from "./context";
import { own, REF_FIELDS, RELATION_TARGET, type Inrichting, type Pad } from "./inrichting";
import { currentHubs, currentVersion, display, ge, geRows, humanize, refId, relation, TECHNICAL, type FullRecord, type Version } from "./register";
import { sanitizeSvg } from "@imprint/widgets-standard/svg-sanitize";
import { JsonTree, parseJsonish } from "./json-tree";
import { OpenFormulier, type Trace } from "./formulier";
import { OmniumDetailConfig, OmniumFormulierConfig, OmniumLijstConfig, OmniumTekeningConfig } from "./schemas";

/**
 * The viewers of omnium-lijst and omnium-detail (server components). They read
 * the register through the request's `Inrichting` (context.ts), never the
 * site's ContentStore: the register is the source, Imprint only shows it.
 * Without lijst-/weergavedefinities in the register (none yet, 5-11-2026)
 * they fall back to an automatic view: per type a few key columns, and in
 * the detail every gegevenselement and relation as the record holds it.
 */

type Cell = ReactNode;
type Column = { label: string; cell: (r: FullRecord, i: Inrichting) => Cell | Promise<Cell> };

const text = (v: unknown) => display(v) || "—";
const titleLink = (pad: Pad): Column => ({
  label: "Naam",
  cell: async (r, i) => {
    const [href, title] = await Promise.all([i.href(pad, r), i.title(pad, r)]);
    return href ? <Link href={href} className="font-medium underline-offset-2 hover:underline">{title}</Link> : title;
  },
});

/** The automatic columns per type. */
const COLUMNS: Record<Pad, Column[]> = {
  componenten: [
    titleLink("componenten"),
    { label: "Technische naam", cell: (r) => <code>{text(ge(r, "component_namen")?.naam)}</code> },
    { label: "Leverancier", cell: (r) => text(ge(r, "component_namen")?.leverancier) },
    { label: "Laag", cell: (r) => text(ge(r, "component_lagen")?.laag) },
  ],
  ediensten: [
    titleLink("ediensten"),
    { label: "Eigenaar", cell: (r) => text(ge(r, "edienst_namen")?.eigenaar) },
    { label: "Omschrijving", cell: (r) => text(ge(r, "edienst_namen")?.omschrijving) },
  ],
  edienstversies: [
    { ...titleLink("edienstversies"), label: "Versie" },
    { label: "Status", cell: (r) => text(ge(r, "edienstversie_statussen")?.status) },
    { label: "Bronmodel", cell: (r) => text(ge(r, "edienstversie_nummers")?.bronmodelVersie) },
  ],
  artefacten: [
    titleLink("artefacten"),
    { label: "Soort", cell: async (r, i) => text(await i.soortcode(r)) },
    { label: "Component", cell: async (r, i) => text(i.componentNaam(await i.componentOfArtefact(r))) },
    { label: "Versie", cell: (r) => text(ge(r, "artefact_identificaties")?.versienummer) },
    {
      label: "Live",
      cell: async (r, i) => {
        const live = await i.liveUrl(r).catch(() => undefined);
        return live ? <a href={live} className="underline-offset-2 hover:underline" rel="noopener noreferrer" target="_blank">openen</a> : "";
      },
    },
  ],
  uitrollen: [
    { ...titleLink("uitrollen"), label: "Gestart" },
    { label: "Status", cell: (r) => text(ge(r, "uitrol_verlopen")?.status) },
    { label: "Door", cell: (r) => text(ge(r, "uitrol_verlopen")?.uitgevoerdDoor) },
  ],
  omgevingen: [
    titleLink("omgevingen"),
    { label: "Soort", cell: (r) => text(ge(r, "omgeving_namen")?.soort) },
    { label: "Basis-URL", cell: (r) => text(ge(r, "omgeving_namen")?.basisUrl) },
  ],
  artefactsoorten: [
    titleLink("artefactsoorten"),
    { label: "Omschrijving", cell: (r) => text(ge(r, "artefactsoort_gegevens")?.omschrijving) },
  ],
  artefactformaten: [
    titleLink("artefactformaten"),
    { label: "Mediatype", cell: (r) => text(ge(r, "artefactformaat_gegevens")?.mediatype) },
  ],
};

/** A source: name, kind, and links to its drawings. */
const BRON_COLUMNS: Column[] = [
  titleLink("artefacten"),
  { label: "Soort", cell: async (r, i) => text(await i.soortcode(r)) },
  {
    label: "Tekeningen",
    cell: async (r, i) => {
      const tekeningen = await i.weergavenVan(r);
      if (!tekeningen.length) return <span className="text-muted">—</span>;
      const links = await Promise.all(
        tekeningen.map(async (t) => ({ href: await i.href("artefacten", t), title: await i.title("artefacten", t) }))
      );
      return (
        <ul className="space-y-0.5">
          {links.map((l, n) => (
            <li key={n}>{l.href ? <Link href={l.href} className="underline-offset-2 hover:underline">{l.title}</Link> : l.title}</li>
          ))}
        </ul>
      );
    },
  },
];

function Table({ head, rows }: { head: string[]; rows: Cell[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-muted">
            {head.map((h) => (
              <th key={h} className="py-2 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, n) => (
            <tr key={n} className="border-b border-line/60 align-top">
              {row.map((cell, m) => (
                <td key={m} className="py-2 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Note = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted">{children}</p>;

/** Rows of field values (a meervoudig GE, or a relation's own fields), the field names as head. */
function fieldTable(rows: Version[], lead?: { label: string; cells: Cell[] }) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r).filter((k) => !TECHNICAL.has(k) && !k.endsWith("_id"))))];
  return (
    <Table
      head={[...(lead ? [lead.label] : []), ...keys.map(humanize)]}
      rows={rows.map((r, n) => [...(lead ? [lead.cells[n]] : []), ...keys.map((k) => <Value key={k} name={k} value={r[k]} />)])}
    />
  );
}

/** One value; URLs as links, long text (a payload) folded. */
function Value({ name, value }: { name: string; value: unknown }) {
  const s = display(value);
  if (!s) return <span className="text-muted">—</span>;
  if (/^https?:\/\/\S+$/.test(s)) {
    return (
      <a href={s} className="break-all underline-offset-2 hover:underline" rel="noopener noreferrer">
        {s}
      </a>
    );
  }
  // JSON (a payload, a nested value): as a tree, folded.
  const json = value && typeof value === "object" ? value : s.length > 160 ? parseJsonish(s) : undefined;
  if (json) {
    return (
      <details>
        <summary className="cursor-pointer text-muted">
          {humanize(name)} (JSON, {s.length} tekens)
        </summary>
        <div className="mt-2">
          <JsonTree value={json} />
        </div>
      </details>
    );
  }
  if (s.length > 160) {
    return (
      <details>
        <summary className="cursor-pointer text-muted">{humanize(name)} ({s.length} tekens)</summary>
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">{s}</pre>
      </details>
    );
  }
  return <span className="break-words">{s}</span>;
}

/** A row with its `$ref` fields (soort, formaat) shown as the code of the item they point to. */
async function withRefs(i: Inrichting, row: Version): Promise<Version> {
  const out: Version = { ...row };
  for (const [field, pad] of Object.entries(REF_FIELDS)) {
    const id = refId(row[field]);
    if (id === undefined) continue;
    const item = await i.byId(pad, id).catch(() => undefined);
    if (item) out[field] = await i.title(pad, item);
  }
  return out;
}

async function relationLinks(i: Inrichting, owner: Pad, record: FullRecord, key: string) {
  const target = RELATION_TARGET[key];
  const links = relation(record, key, own(owner));
  return Promise.all(
    links.map(async (l) => {
      const r = target ? await i.byId(target, l.id) : undefined;
      const label = r && target ? await i.title(target, r) : (l.weergavenaam ?? `#${l.id}`);
      const href = r && target ? await i.href(target, r) : undefined;
      return { link: l, cell: href ? <Link href={href} className="underline-offset-2 hover:underline">{label}</Link> : label };
    })
  );
}

export async function OmniumLijst({ config: raw, subject, ctx: _ctx }: { config: unknown; subject?: unknown; ctx: WidgetContext }) {
  const config = OmniumLijstConfig.parse(raw ?? {});
  const i = inrichtingOf(subject);
  if (!i) return <WidgetFrame title={config.title}><Note>Deze site heeft geen register (OMNIUM_REGISTER_URL).</Note></WidgetFrame>;
  const on = isOmniumSubject(subject) ? subject : undefined;
  try {
    let body: ReactNode;
    if (config.pad) {
      let records = await i.list(config.pad);
      if (config.koppeling) {
        if (!on) return <WidgetFrame title={config.title}><Note>De koppeling “{config.koppeling}” werkt alleen op een inrichtingspagina.</Note></WidgetFrame>;
        records = records.filter((r) => relation(r, config.koppeling, own(config.pad!)).some((l) => l.id === on.record.id));
      }
      if (config.richting && config.pad === "artefacten") {
        const keep = await Promise.all(records.map(async (r) => (await i.richting(r)) === config.richting));
        records = records.filter((_, n) => keep[n]);
      }
      const titled = await Promise.all(records.map(async (r) => ({ r, t: await i.title(config.pad!, r) })));
      titled.sort((a, b) => a.t.localeCompare(b.t, "nl"));
      const cols = config.pad === "artefacten" && config.richting === "bron" ? BRON_COLUMNS : COLUMNS[config.pad];
      const rows = await Promise.all(titled.map(({ r }) => Promise.all(cols.map((c) => c.cell(r, i)))));
      body = rows.length ? <Table head={cols.map((c) => c.label)} rows={rows} /> : <Note>{config.leeg}</Note>;
    } else if (config.veld) {
      if (!on) return <WidgetFrame title={config.title}><Note>“{config.veld}” is een lijst binnen een record: zet de widget op een inrichtingstemplate.</Note></WidgetFrame>;
      if (RELATION_TARGET[config.veld]) {
        const links = await relationLinks(i, on.pad, on.record, config.veld);
        body = links.length
          ? fieldTable(links.map((l) => l.link.velden), { label: "Naar", cells: links.map((l) => l.cell) })
          : <Note>{config.leeg}</Note>;
      } else {
        const rows = geRows(on.record, config.veld);
        body = rows.length ? fieldTable(rows) : <Note>{config.leeg}</Note>;
      }
    } else {
      body = <Note>Kies een type (pad) of een lijst binnen het record (veld).</Note>;
    }
    return config.title ? <WidgetFrame title={config.title}>{body}</WidgetFrame> : <section>{body}</section>;
  } catch (err) {
    return <WidgetFrame title={config.title}><Note>{registerProblem(err)}</Note></WidgetFrame>;
  }
}

export async function OmniumDetail({ config: raw, subject }: { config: unknown; subject?: unknown; ctx: WidgetContext }) {
  const config = OmniumDetailConfig.parse(raw ?? {});
  if (!isOmniumSubject(subject)) {
    return <WidgetFrame title={config.title}><Note>Deze widget toont het record van een inrichtingspagina; zet hem op een template (_view/omnium-…).</Note></WidgetFrame>;
  }
  const i = inrichtingOf(subject)!;
  const hidden = new Set(config.verberg.split(",").map((s) => s.trim()).filter(Boolean));
  const keys = Object.keys(subject.record).filter((k) => !hidden.has(k) && Array.isArray(subject.record[k]) && !TECHNICAL.has(k));
  try {
    const sections = await Promise.all(
      keys.map(async (key) => {
        let body: ReactNode;
        if (RELATION_TARGET[key]) {
          const links = await relationLinks(i, subject.pad, subject.record, key);
          if (!links.length) return null;
          const withFields = links.some((l) => Object.keys(l.link.velden).length > 0);
          body = withFields ? (
            fieldTable(links.map((l) => l.link.velden), { label: "Naar", cells: links.map((l) => l.cell) })
          ) : (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">{links.map((l, n) => <li key={n}>{l.cell}</li>)}</ul>
          );
        } else {
          const hubs = currentHubs(subject.record, key);
          const rows = await Promise.all(hubs.map(currentVersion).filter((v): v is Version => v !== undefined).map((v) => withRefs(i, v)));
          if (!rows.length) return null;
          body =
            rows.length > 1 ? (
              fieldTable(rows)
            ) : (
              <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-1 text-sm">
                {Object.entries(rows[0]!)
                  .filter(([k]) => !TECHNICAL.has(k) && !k.endsWith("_id"))
                  .map(([k, v]) => [
                    <dt key={`${k}-t`} className="text-muted">{humanize(k)}</dt>,
                    <dd key={`${k}-d`}><Value name={k} value={v} /></dd>,
                  ])}
              </dl>
            );
        }
        return (
          <section key={key}>
            <h3 className="mb-2 text-sm font-semibold">{humanize(key)}</h3>
            {body}
          </section>
        );
      })
    );
    return (
      <WidgetFrame title={config.title}>
        <div className="space-y-6">{sections}</div>
      </WidgetFrame>
    );
  } catch (err) {
    return <WidgetFrame title={config.title}><Note>{registerProblem(err)}</Note></WidgetFrame>;
  }
}

/** One drawing from the register, sanitised (allow-list) before it goes inline. */
function Svg({ payload }: { payload: unknown }) {
  const svg = typeof payload === "string" ? sanitizeSvg(payload) : null;
  if (!svg) return <Note>Deze tekening is geen SVG die veilig getoond kan worden.</Note>;
  return (
    <div
      className="overflow-auto rounded-lg border border-line bg-white p-2 [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export async function OmniumTekening({ config: raw, subject }: { config: unknown; subject?: unknown; ctx: WidgetContext }) {
  const config = OmniumTekeningConfig.parse(raw ?? {});
  if (!isOmniumSubject(subject) || subject.pad !== "artefacten") {
    return <WidgetFrame title={config.title}><Note>Deze widget toont de tekeningen van een artefact; zet hem op de template _view/omnium-artefacten.</Note></WidgetFrame>;
  }
  const i = inrichtingOf(subject)!;
  try {
    const richting = await i.richting(subject.record);
    const tekeningen = richting === "weergave" ? [subject.record] : await i.weergavenVan(subject.record);
    if (!tekeningen.length) return null;
    const items = await Promise.all(
      tekeningen.map(async (t) => ({
        title: await i.title("artefacten", t),
        href: t === subject.record ? undefined : await i.href("artefacten", t),
        payload: ge(t, "artefact_inhouden")?.payload,
        versie: ge(t, "artefact_herkomsten")?.regelsetVersie,
      }))
    );
    return (
      <WidgetFrame title={config.title}>
        <div className="space-y-6">
          {items.map((t, n) => (
            <figure key={n} className="space-y-2">
              {t.href ? (
                <figcaption className="text-sm font-semibold">
                  <Link href={t.href} className="underline-offset-2 hover:underline">{t.title}</Link>
                </figcaption>
              ) : null}
              <Svg payload={t.payload} />
              {t.versie ? <p className="text-xs text-muted">Getekend door render {display(t.versie)}</p> : null}
            </figure>
          ))}
        </div>
      </WidgetFrame>
    );
  } catch (err) {
    return <WidgetFrame title={config.title}><Note>{registerProblem(err)}</Note></WidgetFrame>;
  }
}

export async function OmniumFormulier({ config: raw, subject }: { config: unknown; subject?: unknown; ctx: WidgetContext }) {
  const config = OmniumFormulierConfig.parse(raw ?? {});
  if (!isOmniumSubject(subject) || subject.pad !== "artefacten") {
    return <WidgetFrame title={config.title}><Note>Deze widget toont een formulier-artefact; zet hem op de template _view/omnium-artefacten.</Note></WidgetFrame>;
  }
  const i = inrichtingOf(subject)!;
  try {
    if ((await i.soortcode(subject.record)) !== "formulier") return null;
    const raw = ge(subject.record, "artefact_inhouden")?.payload;
    const payload = typeof raw === "string" ? parseJsonish(raw) : raw;
    const traces = new Map<string, Trace>(
      geRows(subject.record, "artefact_traceregels").map((t) => [String(t.doelPad ?? ""), { bronGE: t.bronGE as string | undefined, regel: t.regel as string | undefined }])
    );
    return (
      <WidgetFrame title={config.title}>
        <OpenFormulier payload={payload} traces={traces} />
      </WidgetFrame>
    );
  } catch (err) {
    return <WidgetFrame title={config.title}><Note>{registerProblem(err)}</Note></WidgetFrame>;
  }
}

export const omniumViewers: WidgetViewers = {
  "omnium-formulier": OmniumFormulier as WidgetViewers[string],
  "omnium-tekening": OmniumTekening as WidgetViewers[string],
  "omnium-lijst": OmniumLijst as WidgetViewers[string],
  "omnium-detail": OmniumDetail as WidgetViewers[string],
};
