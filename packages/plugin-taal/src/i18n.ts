/**
 * The fixed texts of the language training, per interface language (the first
 * segment of the address). Plain data, so it can go to the client parts as a
 * prop. A new interface language is one more entry here.
 *
 * The Polish texts are a first translation: to be read by a Polish speaker.
 */
export type Teksten = {
  /** The language taught, as "in Dutch": `{ nl: "in het Nederlands" }`. */
  inTaal: Record<string, string>;
  /** The name of a package: `{ nl: "Nederlands" }`. */
  pakket: Record<string, string>;
  lessen: string;
  fase: string;
  alleLessen: string;
  geenLessen: string;
  dialoog: string;
  brokken: string;
  oefeningen: string;
  ombouwen: string;
  zagJeDat: string;
  speel: string;
  langzaam: string;
  luister: string;
  zetOpVolgorde: string;
  zegIn: string;
  zegHardopIn: string;
  voorbeeld: string;
  controleer: string;
  volgende: string;
  nogEenKeer: string;
  goed: string;
  bijvoorbeeld: string;
  juist: string;
  spreek: string;
  ikLuister: string;
  gehoord: string;
  bijna: string;
  zonderMicrofoon: string;
  geenHerkenning: string;
  zelfBeoordelen: string;
  gelukt: string;
  nogNiet: string;
  vanGoed: string;
  zelfBeoordeeld: string;
  score: string;
  vorige: string;
  volgendeLes: string;
};

const nl: Teksten = {
  inTaal: { nl: "in het Nederlands", pl: "in het Pools", it: "in het Italiaans", de: "in het Duits" },
  pakket: { nl: "Nederlands", pl: "Pools", it: "Italiaans", de: "Duits" },
  lessen: "Lessen",
  fase: "Fase",
  alleLessen: "Alle lessen",
  geenLessen: "Er zijn nog geen lessen.",
  dialoog: "Dialoog",
  brokken: "Brokken",
  oefeningen: "Oefeningen",
  ombouwen: "Ombouwen",
  zagJeDat: "Zag je dat?",
  speel: "Speel af",
  langzaam: "Langzaam",
  luister: "Luister",
  zetOpVolgorde: "Zet de woorden op volgorde.",
  zegIn: "Zeg {taal}:",
  zegHardopIn: "Zeg hardop {taal}:",
  voorbeeld: "Voorbeeld",
  controleer: "Controleer",
  volgende: "Volgende",
  nogEenKeer: "Nog een keer",
  goed: "Goed!",
  bijvoorbeeld: "Bijvoorbeeld:",
  juist: "Juist:",
  spreek: "Spreek",
  ikLuister: "Ik luister…",
  gehoord: "Gehoord:",
  bijna: "Bijna. Probeer nog eens ({n} over).",
  zonderMicrofoon: "Zonder microfoon",
  geenHerkenning: "Deze browser kan niet meeluisteren (dat kan in Chrome, Edge en Safari, via https).",
  zelfBeoordelen: "Luister naar het voorbeeld, zeg het hardop na en beoordeel jezelf.",
  gelukt: "Gelukt",
  nogNiet: "Nog niet",
  vanGoed: "{score} van {totaal} goed.",
  zelfBeoordeeld: "waarvan {n} zelf beoordeeld",
  score: "{score} van {totaal}",
  vorige: "Vorige les",
  volgendeLes: "Volgende les",
};

const pl: Teksten = {
  inTaal: { nl: "po niderlandzku", pl: "po polsku", it: "po włosku", de: "po niemiecku" },
  pakket: { nl: "Niderlandzki", pl: "Polski", it: "Włoski", de: "Niemiecki" },
  lessen: "Lekcje",
  fase: "Etap",
  alleLessen: "Wszystkie lekcje",
  geenLessen: "Nie ma jeszcze lekcji.",
  dialoog: "Dialog",
  brokken: "Zwroty",
  oefeningen: "Ćwiczenia",
  ombouwen: "Przebuduj",
  zagJeDat: "Zauważyłeś?",
  speel: "Odtwórz",
  langzaam: "Powoli",
  luister: "Posłuchaj",
  zetOpVolgorde: "Ułóż słowa w odpowiedniej kolejności.",
  zegIn: "Powiedz {taal}:",
  zegHardopIn: "Powiedz na głos {taal}:",
  voorbeeld: "Przykład",
  controleer: "Sprawdź",
  volgende: "Dalej",
  nogEenKeer: "Jeszcze raz",
  goed: "Dobrze!",
  bijvoorbeeld: "Na przykład:",
  juist: "Poprawnie:",
  spreek: "Mów",
  ikLuister: "Słucham…",
  gehoord: "Usłyszano:",
  bijna: "Prawie. Spróbuj jeszcze raz (zostało: {n}).",
  zonderMicrofoon: "Bez mikrofonu",
  geenHerkenning: "Ta przeglądarka nie rozpoznaje mowy (działa to w Chrome, Edge i Safari, przez https).",
  zelfBeoordelen: "Posłuchaj przykładu, powtórz na głos i oceń się samodzielnie.",
  gelukt: "Udało się",
  nogNiet: "Jeszcze nie",
  vanGoed: "Dobrze: {score} z {totaal}.",
  zelfBeoordeeld: "w tym ocenione samodzielnie: {n}",
  score: "{score} z {totaal}",
  vorige: "Poprzednia lekcja",
  volgendeLes: "Następna lekcja",
};

export const TEKSTEN: Record<string, Teksten> = { nl, pl };

/** The interface languages the plugin has texts for. */
export const UI_TALEN = Object.keys(TEKSTEN);

export const teksten = (ui: string): Teksten => TEKSTEN[ui] ?? nl;

/** Fill `{name}` placeholders. */
export const vul = (tekst: string, waarden: Record<string, string | number>): string =>
  tekst.replace(/\{(\w+)\}/g, (_, k: string) => String(waarden[k] ?? ""));
