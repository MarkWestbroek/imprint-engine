import { z } from "zod";
import {
  BoardSpecSchema,
  ComponentSchema,
  MenuSchema,
  PageMetaSchema,
  ProductSchema,
  ReleaseSchema,
  SiteConfigSchema,
  ThemeSchema,
  type RelationRule,
} from "@imprint/content-core";

/**
 * Exporteert het Imprint-contentmodel als **V3Model** — het geneste
 * metamodelformaat van het bitemporal-project (Omnium Studio), zodat de
 * formuliereditor/ModelPicker daar rechtstreeks velden uit kan plukken.
 * Zie docs/design/v3-metamodel-spec.md (de aangeleverde spec) voor het
 * contract; de mapping volgt §7 daarvan:
 *
 *   contenttype → entiteit · scalars → gegevenselement "Kern" ·
 *   array-van-objecten → meervoudig GE · object → enkelvoudig GE ·
 *   relatieregel → relatie (incl. velden óp de relatie, bv. de versie op
 *   Release↔Component) · zod-enum → centrale enum · patronen/namen →
 *   datatypes (Slug, Versienummer, Markdown, Kleur, AssetUrl, Json).
 *
 * Alles wordt afgeleid uit dezelfde zod-schema's die de content valideren
 * (via z.toJSONSchema), dus het V3-model kan niet uit de pas lopen met wat
 * de store accepteert. Diagram-/layout- en runtime-blokken uit de spec
 * laten we weg (mag, zie spec §3/§7).
 */

type JS = {
  type?: string | string[];
  properties?: Record<string, JS>;
  items?: JS;
  enum?: unknown[];
  pattern?: string;
  format?: string;
  required?: string[];
  additionalProperties?: JS | boolean;
  description?: string;
  anyOf?: JS[];
};

type V3Veld = {
  naam: string;
  goType: string;
  type: string;
  format?: string;
  verplicht?: boolean;
  enum?: string;
  datatype?: string;
  $ref?: string;
  description?: string;
};

type V3GE = { naam: string; meervoud: string; momentvoorkomen: string; velden: V3Veld[] };
type V3Relatie = {
  naam: string;
  meervoud: string;
  doelEntiteit: string;
  momentvoorkomen: string;
  doelKardinaliteit: string;
  velden: V3Veld[];
};
type V3Entiteit = {
  typenaam: string;
  meervoud: string;
  domein: string;
  description?: string;
  gegevenselementen: V3GE[];
  relaties: V3Relatie[];
};

const TYPES: { type: string; typenaam: string; meervoud: string; domein: string; schema: z.ZodType }[] = [
  { type: "product", typenaam: "Product", meervoud: "products", domein: "catalogus", schema: ProductSchema },
  { type: "component", typenaam: "Component", meervoud: "components", domein: "catalogus", schema: ComponentSchema },
  { type: "board-spec", typenaam: "BoardSpec", meervoud: "board-specs", domein: "catalogus", schema: BoardSpecSchema },
  { type: "release", typenaam: "Release", meervoud: "releases", domein: "catalogus", schema: ReleaseSchema },
  { type: "page", typenaam: "Page", meervoud: "pages", domein: "site", schema: PageMetaSchema },
  { type: "menu", typenaam: "Menu", meervoud: "menus", domein: "site", schema: MenuSchema },
  { type: "theme", typenaam: "Theme", meervoud: "themes", domein: "site", schema: ThemeSchema },
  { type: "site", typenaam: "Site", meervoud: "sites", domein: "site", schema: SiteConfigSchema },
];

const TYPENAAM: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.type, t.typenaam]));

const MARKDOWN_FIELDS = new Set(["description", "body", "markdown", "notes", "docs", "jlcNotes"]);
const ASSET_PARENTS = new Set(["assets", "view3d"]);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function unwrap(js: JS): JS {
  // anyOf uit optioneel/nullable: pak de eerste niet-null-variant.
  if (js.anyOf) return unwrap(js.anyOf.find((v) => v.type !== "null") ?? js.anyOf[0]);
  return js;
}
const jsType = (js: JS): string =>
  Array.isArray(js.type) ? (js.type.find((t) => t !== "null") ?? "string") : (js.type ?? "string");

export function buildV3Model(opts: { siteName: string; rules: RelationRule[] }) {
  const enums = new Map<string, { goType: string; baseType: string; waarden: { constNaam: string; waarde: string }[] }>();

  function registerEnum(name: string, values: unknown[]): string {
    if (!enums.has(name)) {
      enums.set(name, {
        goType: name,
        baseType: "string",
        waarden: values.map((v) => ({ constNaam: cap(String(v)).replace(/[^A-Za-z0-9]/g, ""), waarde: String(v) })),
      });
    }
    return name;
  }

  function detectDatatype(name: string, js: JS, parent?: string): string | undefined {
    if (js.pattern?.startsWith("^v?\\d")) return "Versienummer";
    if (js.pattern?.startsWith("^#") || parent === "colors") return "Kleur";
    if (name === "slug" || js.pattern?.startsWith("^[a-z0-9")) return "Slug";
    if (MARKDOWN_FIELDS.has(name)) return "Markdown";
    if (parent && ASSET_PARENTS.has(parent) && name !== "mode") return "AssetUrl";
    return undefined;
  }

  /** Eén veld; complexe substructuren worden een Json-veld (spec §6-conform). */
  function veld(typenaam: string, name: string, raw: JS, required: boolean, parent?: string): V3Veld {
    const js = unwrap(raw);
    const t = jsType(js);
    if (js.enum) {
      const enumName =
        name === "lang" || name === "defaultLocale"
          ? registerEnum("Locale", js.enum)
          : registerEnum(`${typenaam}${cap(name)}`, js.enum);
      return { naam: name, goType: enumName, type: "string", enum: enumName, ...(required && { verplicht: true }) };
    }
    if (t === "object" || t === "array") {
      return { naam: name, goType: "string", type: "string", datatype: "Json",
        description: js.description ?? "JSON-substructuur (zie JSON Schema-vorm van /api/meta)" };
    }
    const base = t === "integer" || t === "number" || t === "boolean" ? t : "string";
    const datatype = base === "string" ? detectDatatype(name, js, parent) : undefined;
    const format = js.pattern === "^\\d{4}-\\d{2}-\\d{2}$" ? "date" : js.format;
    return {
      naam: name,
      goType: base,
      type: base,
      ...(format && { format }),
      ...(required && { verplicht: true }),
      ...(datatype && { datatype }),
      ...(js.description && { description: js.description }),
    };
  }

  function entiteit(def: (typeof TYPES)[number]): V3Entiteit {
    const js = z.toJSONSchema(def.schema, { io: "input" }) as JS;
    const required = new Set(js.required ?? []);
    const kern: V3Veld[] = [];
    const ges: V3GE[] = [];
    const relaties: V3Relatie[] = [];

    for (const [name, rawProp] of Object.entries(js.properties ?? {})) {
      const prop = unwrap(rawProp);
      const rule = opts.rules.find(
        (r) => r.fromType === def.type && (r.field === name || r.field === `${name}[]` || r.field.startsWith(`${name}[].`))
      );

      if (rule) {
        const meervoudig = rule.field.includes("[]");
        // "components[].component": de overige item-velden horen óp de relatie
        // (UML: de associatie draagt ze — bv. de versie op Release↔Component).
        const relVelden: V3Veld[] = [];
        if (rule.field.includes("].")) {
          const refKey = rule.field.split("].")[1];
          const item = unwrap(prop.items ?? {});
          for (const [n, p] of Object.entries(item.properties ?? {})) {
            if (n !== refKey) relVelden.push(veld(def.typenaam, n, p, (item.required ?? []).includes(n)));
          }
        }
        relaties.push({
          naam: `Rel_${def.typenaam}_${cap(name)}`,
          meervoud: name,
          doelEntiteit: TYPENAAM[rule.toType] ?? cap(rule.toType),
          momentvoorkomen: meervoudig ? "meervoudig" : "enkelvoudig",
          doelKardinaliteit: meervoudig ? "0..*" : required.has(name) ? "1" : "0..1",
          velden: relVelden,
        });
        continue;
      }

      const t = jsType(prop);
      if (t === "array") {
        const item = unwrap(prop.items ?? {});
        if (jsType(item) === "object" && item.properties) {
          ges.push({
            naam: cap(name), meervoud: name, momentvoorkomen: "meervoudig",
            velden: Object.entries(item.properties).map(([n, p]) =>
              veld(def.typenaam, n, p, (item.required ?? []).includes(n), name)),
          });
        } else {
          // herhaalbare scalar (media, highlights, related): meervoudig GE met één veld
          ges.push({
            naam: cap(name), meervoud: name, momentvoorkomen: "meervoudig",
            velden: [veld(def.typenaam, "value", item, true, name)],
          });
        }
      } else if (t === "object" && prop.properties) {
        ges.push({
          naam: cap(name), meervoud: name, momentvoorkomen: "enkelvoudig",
          velden: Object.entries(prop.properties).map(([n, p]) =>
            veld(def.typenaam, n, p, (prop.required ?? []).includes(n), name)),
        });
      } else {
        kern.push(veld(def.typenaam, name, prop, required.has(name)));
      }
    }

    return {
      typenaam: def.typenaam,
      meervoud: def.meervoud,
      domein: def.domein,
      gegevenselementen: [{ naam: "Kern", meervoud: "kernen", momentvoorkomen: "enkelvoudig", velden: kern }, ...ges],
      relaties,
    };
  }

  const entiteiten = TYPES.map(entiteit);

  return {
    versie: "imprint-v1",
    naam: `Imprint contentmodel — ${opts.siteName}`,
    beschrijving:
      "Afgeleid uit de zod-contentschema's van de Imprint-engine. Afgeleide content " +
      "(itinerary) staat niet in het model: die is berekend, niet opgeslagen.",
    domeinen: [
      { naam: "catalogus", beschrijving: "Product-, component- en release-catalogus", kleur: "#34d399" },
      { naam: "site", beschrijving: "Site-inrichting: pagina's, navigatie, thema's, configuratie", kleur: "#6366f1" },
    ],
    datatypes: [
      { naam: "Slug", basistype: "string", validatie: { pattern: "^[a-z0-9-]+$", voorbeelden: ["busboard-v2"] },
        omschrijving: "Identiteit van een content-item; board-specs staan ook @ en punt toe, pagina's ook / en _" },
      { naam: "Versienummer", basistype: "string",
        validatie: { pattern: "^v?\\d+(\\.\\d+)*([.-][0-9A-Za-z-]+)*$", voorbeelden: ["v2.5.12", "1.0.0"] } },
      { naam: "Markdown", basistype: "string", weergave: { widget: "richtext", multiline: true } },
      { naam: "Kleur", basistype: "string", validatie: { pattern: "^#[0-9a-fA-F]{3,8}$" },
        weergave: { widget: "color" } },
      { naam: "AssetUrl", basistype: "string", weergave: { widget: "media" },
        omschrijving: "URL uit de AssetStore (/api/assets/…) of statisch pad" },
      { naam: "Json", basistype: "string", weergave: { widget: "textarea", multiline: true },
        omschrijving: "Substructuur die (nog) niet als velden is uitgeschreven; schema in de JSON Schema-vorm" },
    ],
    enums: [...enums.values()],
    referentielijstInstanties: [],
    entiteiten,
  };
}
