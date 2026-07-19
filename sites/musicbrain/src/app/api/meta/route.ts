import { NextResponse } from "next/server";
import { z } from "zod";
import {
  BoardSpecSchema,
  ComponentSchema,
  DEFAULT_RELATION_RULES,
  MenuSchema,
  PageMetaSchema,
  ProductSchema,
  ReleaseSchema,
  RelationsDoc,
  SiteConfigSchema,
  ThemeSchema,
} from "@imprint/content-core";
import { writableStore } from "@/lib/content";

/**
 * Metamodel-endpoint: het contentmodel van deze imprint, machine-leesbaar.
 * Bedoeld voor externe form-builders (Marks bitemporal/Omnium-spoor): elk
 * contenttype als JSON Schema (draft 2020-12, rechtstreeks uit dezelfde
 * zod-schema's die de content valideren — dit kán dus niet uit de pas lopen)
 * plus de relatieregels als referentietypen: welk veld naar welk type wijst
 * en waar je de mogelijke waarden ophaalt. Een V3-vertaling (het
 * metamodelformaat uit het bitemporal-project) kan hier later naast staan
 * onder ?format=v3 zodra dat formaat is aangeleverd.
 */

const TYPE_SCHEMAS: Record<string, z.ZodType> = {
  site: SiteConfigSchema,
  product: ProductSchema,
  component: ComponentSchema,
  "board-spec": BoardSpecSchema,
  release: ReleaseSchema,
  page: PageMetaSchema,
  menu: MenuSchema,
  theme: ThemeSchema,
};

function toSchema(schema: z.ZodType): Record<string, unknown> {
  try {
    // io:"input": beschrijft wat een producent mag insturen (defaults optioneel).
    return z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET() {
  const types = Object.fromEntries(
    Object.entries(TYPE_SCHEMAS).map(([name, schema]) => [name, toSchema(schema)])
  );

  // Actieve relatieregels (beheerd in /admin/relations); zonder DB de defaults.
  let rules = DEFAULT_RELATION_RULES;
  if (writableStore) {
    const item = await writableStore.getItem("relations", "relations");
    if (item) {
      const parsed = RelationsDoc.safeParse(item.data);
      if (parsed.success) rules = parsed.data.rules;
    }
  }

  return NextResponse.json(
    {
      format: "json-schema-2020-12",
      generator: "imprint",
      types,
      /**
       * Referentievelden: `field` is een pad in `fromType` ("a", "a[]",
       * "a[].b") dat slugs van `toType` bevat; kandidaatwaarden haal je uit
       * GET /api/content/<toType>s (zelfde API). `enforce` zegt of de store
       * een onbekende verwijzing weigert.
       */
      references: rules,
      derived: {
        itinerary: {
          description:
            "Afgeleid, niet opgeslagen: de reis van componentversies door de " +
            "releases van een product. GET /api/content/itinerary/<product>.",
          from: ["release"],
        },
      },
    },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
