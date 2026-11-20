import type { Catalog } from "@imprint/content-core";

/**
 * The fixed texts of this site's header and footer, per language
 * (design/meertaligheid.md layer 2). Dutch is the site's language; English is
 * here for the translation the site gets (layer 4).
 */
export type SiteMessages = {
  homeLabel: string;
  mainNavigation: string;
  openMenu: string;
  viewCode: string;
  footerLine: string;
  nav: { features: string; practice: string; brand: string; clients: string };
};

export const siteMessages = {
  en: {
    homeLabel: "Imprint, to the home page",
    mainNavigation: "Main navigation",
    openMenu: "Open menu",
    viewCode: "View the code",
    footerLine: "Developed from a real product site, not from an empty template.",
    nav: { features: "Features", practice: "In practice", brand: "Brand proposals", clients: "Have a website built" },
  },
  nl: {
    homeLabel: "Imprint, naar home",
    mainNavigation: "Hoofdnavigatie",
    openMenu: "Menu openen",
    viewCode: "Bekijk de code",
    footerLine: "Ontwikkeld vanuit een echte productsite, niet vanuit een leeg template.",
    nav: { features: "Mogelijkheden", practice: "In de praktijk", brand: "Merkvoorstellen", clients: "Website laten bouwen" },
  },
} satisfies Catalog<SiteMessages>;
