import { pakketNaam, pakketTaal } from "@imprint/plugin-taal/href";

/**
 * The entrances of the site: a reader's language with the package they learn,
 * and for it the front page and the menu from the store. Plain data: the
 * client parts of the header read it too, so nothing here may import the
 * server's config.
 *
 *   pl → nl   /     page `home`,    menu `main`      Dutch for Polish speakers (the default)
 *   en → nl   /en   page `home-en`, menu `main-en`   Dutch for English speakers
 *   nl → pl   /nl   page `home-nl`, menu `main-nl`   Polish for Dutch speakers (jezyk.imprint-engine.nl opens here)
 *
 * `talen` are the interface languages the header offers in this entrance.
 * `naam` and `tagline` replace those of the site config.
 */
export type Ingang = { ui: string; pakket: string; start: string; home: string; menu: string; naam?: string; tagline?: string; talen: string[] };

export const STANDAARD_UI = "pl";

const NEDERLANDS = ["pl", "en", "nl"];

export const INGANGEN: Ingang[] = [
  { ui: "pl", pakket: "nl", start: "/", home: "home", menu: "main", talen: NEDERLANDS },
  { ui: "en", pakket: "nl", start: "/en", home: "home-en", menu: "main-en", tagline: "slowly but surely", talen: NEDERLANDS },
  { ui: "nl", pakket: "pl", start: "/nl", home: "home-nl", menu: "main-nl", naam: "Powoli, ale do przodu", tagline: "langzaam maar zeker", talen: [] },
];

const standaard = INGANGEN.find((i) => i.ui === STANDAARD_UI)!;

/** The entrance of a reader's language: for the pages without a package in their address (account, contact). */
export const ingangVan = (ui: string): Ingang => INGANGEN.find((i) => i.ui === ui) ?? standaard;

/** The entrance whose front page is this page of the store, if any. */
export const ingangMetHome = (slug: string): Ingang | undefined => INGANGEN.find((i) => i.home === slug);

export type NavItem = { href: string; label: string };

/**
 * Where an address belongs. `/<ui>/<pakket>/…`: the entrance of that reader
 * and that package, else the first one of the package (Dutch taught in Dutch
 * sits in the Polish entrance). `/<ui>/…`: the reader's entrance. A page of
 * the store has no language in its address (`/about-the-method`): it belongs
 * to the entrance whose menu links to it, else to the default.
 * `lezer` is the language of the texts around the page.
 */
export function ingangVoor(path: string, ui: string[], menus: Record<string, NavItem[]>): { ingang: Ingang; current: string | null; lezer: string } {
  const [, first, second] = path.split("/");
  const current = first && ui.includes(first) ? first : null;
  if (current) {
    const pakket = second ? pakketTaal(second) : null;
    const ingang = pakket ? (INGANGEN.find((i) => i.ui === current && i.pakket === pakket) ?? INGANGEN.find((i) => i.pakket === pakket)) : undefined;
    return { ingang: ingang ?? ingangVan(current), current, lezer: current };
  }
  const viaMenu = path === "/" ? undefined : INGANGEN.find((i) => (menus[i.menu] ?? []).some((item) => item.href === path));
  const ingang = viaMenu ?? standaard;
  return { ingang, current, lezer: ingang.ui };
}

/** Where the choice of another interface language leads from this address: the same page if there is one, else that reader's start. */
export function wissel(path: string, code: string, ingang: Ingang, current: string | null): string {
  const [, , ...rest] = path.split("/");
  if (current && rest.length > 0) return `/${[code, ...rest].join("/")}`;
  return INGANGEN.find((i) => i.ui === code && i.pakket === ingang.pakket)?.start ?? `/${code}/${pakketNaam(ingang.pakket)}`;
}
