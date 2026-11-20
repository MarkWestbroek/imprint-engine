import type { Catalog } from "@imprint/content-core";

/**
 * The fixed texts of the engine's public screens, per language
 * (design/meertaligheid.md layer 2): what a visitor reads. The admin and the
 * studio are layer 3 and still have their texts in place. The Polish texts
 * are a first translation, to be read by a Polish speaker.
 */
export type PublicMessages = {
  search: {
    title: string;
    term: string;
    placeholder: string;
    submit: string;
    /** Before the list of prefixes: "Tip: search one kind with a prefix, for example". */
    tip: string;
    /** "3 results", "1 result", "No results". */
    results: (n: number) => string;
    /** Between the count and the quoted query: "for". */
    forQuery: string;
    firstShown: (limit: number) => string;
  };
};

export const publicMessages = {
  en: {
    search: {
      title: "Search",
      term: "Search term",
      placeholder: "What are you looking for?",
      submit: "Search",
      tip: "Tip: search one kind with a prefix, for example",
      results: (n) => (n === 0 ? "No results" : n === 1 ? "1 result" : `${n} results`),
      forQuery: "for",
      firstShown: (limit) => `The first ${limit} are shown; make your search more precise.`,
    },
  },
  nl: {
    search: {
      title: "Zoeken",
      term: "Zoekterm",
      placeholder: "Waar ben je naar op zoek?",
      submit: "Zoeken",
      tip: "Tip: zoek in één soort met een voorvoegsel, bijvoorbeeld",
      results: (n) => (n === 0 ? "Geen resultaten" : n === 1 ? "1 resultaat" : `${n} resultaten`),
      forQuery: "voor",
      firstShown: (limit) => `De eerste ${limit} worden getoond; maak je zoekterm preciezer.`,
    },
  },
  pl: {
    search: {
      title: "Szukaj",
      term: "Szukane hasło",
      placeholder: "Czego szukasz?",
      submit: "Szukaj",
      tip: "Wskazówka: szukaj w jednym rodzaju treści, dodając przedrostek, na przykład",
      // Polish plural: 1 wynik, 2-4 wyniki (not 12-14), else wyników.
      results: (n) => {
        if (n === 0) return "Brak wyników";
        if (n === 1) return "1 wynik";
        const few = n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14);
        return `${n} ${few ? "wyniki" : "wyników"}`;
      },
      forQuery: "dla",
      firstShown: (limit) => `Pokazano pierwsze ${limit}; doprecyzuj wyszukiwanie.`,
    },
  },
} satisfies Catalog<PublicMessages>;
