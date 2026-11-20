/**
 * The entrances of the site: per interface language (the first segment of the
 * address) the menu and the front page from the store, and where "home" is.
 * Plain data: the client parts of the header read it too, so nothing here may
 * import the server's config.
 *
 *   pl  /     page `home`,    menu `main`      Dutch for Polish speakers (the default)
 *   en  /en   page `home-en`, menu `main-en`   Dutch for English speakers
 *
 * An interface language without an entrance (nl: Dutch taught in Dutch) uses
 * the default one.
 */
export type Ingang = { ui: string; start: string; home: string; menu: string; tagline?: string };

export const STANDAARD_UI = "pl";

export const INGANGEN: Ingang[] = [
  { ui: "pl", start: "/", home: "home", menu: "main" },
  { ui: "en", start: "/en", home: "home-en", menu: "main-en", tagline: "slowly but surely" },
];

export const ingangVan = (ui: string): Ingang => INGANGEN.find((i) => i.ui === ui) ?? INGANGEN.find((i) => i.ui === STANDAARD_UI)!;

/** The entrance whose front page is this page of the store, if any. */
export const ingangMetHome = (slug: string): Ingang | undefined => INGANGEN.find((i) => i.home === slug);
