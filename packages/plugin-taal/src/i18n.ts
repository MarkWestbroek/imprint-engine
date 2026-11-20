/**
 * The fixed texts of the language training, per interface language (the first
 * segment of the address). Plain data, so it can go to the client parts as a
 * prop. A new interface language is one more entry here.
 *
 * The Polish texts are a first translation: to be read by a Polish speaker.
 */
import { heeftVormen } from "./tekst";

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
  /** The choice between masculine and feminine forms (tekst.ts); only shown when the language has them (`kentVormen`). */
  vorm: { vraag: string; m: string; v: string; beide: string };
  /** The widget "verder": continue where you left off. */
  verder: { begin: string; uitleg: string; dalej: string; gedaan: string; alles: string; overzicht: string };
  /** The grammar reference (grammatica.ts); `intro` fills {taal} with `inTaal`. */
  grammatica: {
    naam: string;
    intro: string;
    groepen: Record<"werkwoorden" | "naamwoorden" | "naamvallen" | "voornaamwoorden" | "zinsbouw" | "verschil", string>;
    anders: string;
    meer: string;
    inLessen: string;
    alle: string;
    uitspreken: string;
    geen: string;
  };
  /** "Check a word" (woordzoeker.tsx); `bron` fills {bron}, `intro` {aantal}. */
  woorden: {
    naam: string;
    intro: string;
    zoek: string;
    voorbeeld: string;
    geen: string;
    suggesties: string;
    naamwoord: string;
    werkwoord: string;
    meervoud: string;
    geenMeervoud: string;
    verkleinwoord: string;
    regelmatig: string;
    onregelmatig: string;
    tt: string;
    vt: string;
    vd: string;
    hulp: { hebben: string; zijn: string; beide: string };
    bron: string;
  };
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
  vorm: { vraag: "Vormen:", m: "hij", v: "zij", beide: "beide" },
  verder: {
    begin: "Begin bij les 1",
    uitleg: "Geen account nodig, geen aanmelding: begin gewoon.",
    dalej: "Verder met les {nr}",
    gedaan: "Lessen gedaan: {n} van {totaal}",
    alles: "Alle lessen gedaan. Gefeliciteerd!",
    overzicht: "Alle lessen",
  },
  grammatica: {
    naam: "Grammatica",
    intro: "De vormen en regels op een rij, om op te zoeken als je de taal al een beetje kent. Vetgedrukte woorden zijn {taal}: klik erop om ze te horen.",
    groepen: {
      werkwoorden: "Werkwoorden",
      naamwoorden: "Zelfstandige naamwoorden en lidwoorden",
      voornaamwoorden: "Voornaamwoorden",
      zinsbouw: "Zinsbouw",
      naamvallen: "Naamvallen",
      verschil: "Verschillen met je eigen taal",
    },
    anders: "Anders dan in je eigen taal",
    meer: "Meer hierover:",
    inLessen: "In de lessen:",
    alle: "Alle grammatica",
    uitspreken: "Luister",
    geen: "Er zijn nog geen onderwerpen.",
  },
  woorden: {
    naam: "Zoek een woord",
    intro: "Typ een Nederlands zelfstandig naamwoord of werkwoord. Bij een zelfstandig naamwoord zie je *de* of *het* en het meervoud, bij een werkwoord alle vormen. De lijst heeft zo'n {aantal} veelgebruikte woorden, tot ongeveer niveau B1.",
    zoek: "Zoek een woord",
    voorbeeld: "bijv. huis, lopen, liep",
    geen: "Dit woord staat niet in de lijst.",
    suggesties: "Woorden die passen",
    naamwoord: "Zelfstandig naamwoord",
    werkwoord: "Werkwoord",
    meervoud: "meervoud",
    geenMeervoud: "geen meervoud",
    verkleinwoord: "verkleinwoord",
    regelmatig: "regelmatig",
    onregelmatig: "onregelmatig",
    tt: "Tegenwoordige tijd",
    vt: "Verleden tijd",
    vd: "Voltooide tijd",
    hulp: {
      hebben: "Met hebben.",
      zijn: "Met zijn.",
      beide: "Met hebben, of met zijn als je zegt waarheen: Ik heb gelopen. Ik ben naar huis gelopen.",
    },
    bron: "Bron: {bron}",
  },
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
  zagJeDat: "Zauważył{eś|aś}?",
  vorm: { vraag: "Formy:", m: "on", v: "ona", beide: "on/ona" },
  verder: {
    begin: "Zacznij od lekcji 1",
    uitleg: "Bez konta i bez rejestracji: po prostu zacznij.",
    dalej: "Dalej: lekcja {nr}",
    gedaan: "Ukończone lekcje: {n} z {totaal}",
    alles: "Wszystkie lekcje ukończone. Gratulacje!",
    overzicht: "Wszystkie lekcje",
  },
  grammatica: {
    naam: "Gramatyka",
    intro: "Formy i reguły w jednym miejscu, do sprawdzenia, kiedy już trochę znasz język. Pogrubione słowa są {taal}: kliknij, żeby je usłyszeć.",
    groepen: {
      werkwoorden: "Czasowniki",
      naamwoorden: "Rzeczowniki i rodzajniki",
      voornaamwoorden: "Zaimki",
      zinsbouw: "Budowa zdania",
      naamvallen: "Przypadki",
      verschil: "Inaczej niż po polsku",
    },
    anders: "Inaczej niż po polsku",
    meer: "Więcej na ten temat:",
    inLessen: "W lekcjach:",
    alle: "Cała gramatyka",
    uitspreken: "Posłuchaj",
    geen: "Nie ma jeszcze tematów.",
  },
  woorden: {
    naam: "Sprawdź słowo",
    intro: "Wpisz niderlandzki rzeczownik albo czasownik. Przy rzeczowniku zobaczysz *de* albo *het* i liczbę mnogą, przy czasowniku wszystkie formy. Lista ma około {aantal} często używanych słów, mniej więcej do poziomu B1.",
    zoek: "Szukaj słowa",
    voorbeeld: "np. huis, lopen, liep",
    geen: "Tego słowa nie ma na liście.",
    suggesties: "Pasujące słowa",
    naamwoord: "Rzeczownik",
    werkwoord: "Czasownik",
    meervoud: "liczba mnoga",
    geenMeervoud: "bez liczby mnogiej",
    verkleinwoord: "zdrobnienie",
    regelmatig: "regularny",
    onregelmatig: "nieregularny",
    tt: "Czas teraźniejszy",
    vt: "Czas przeszły",
    vd: "Czas przeszły złożony",
    hulp: {
      hebben: "Z hebben.",
      zijn: "Z zijn.",
      beide: "Z hebben, albo z zijn, gdy mówisz dokąd: Ik heb gelopen. Ik ben naar huis gelopen.",
    },
    bron: "Źródło: {bron}",
  },
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

const en: Teksten = {
  inTaal: { nl: "in Dutch", pl: "in Polish", it: "in Italian", de: "in German" },
  pakket: { nl: "Dutch", pl: "Polish", it: "Italian", de: "German" },
  lessen: "Lessons",
  fase: "Phase",
  alleLessen: "All lessons",
  geenLessen: "There are no lessons yet.",
  dialoog: "Dialogue",
  brokken: "Chunks",
  oefeningen: "Exercises",
  ombouwen: "Make it your own",
  zagJeDat: "Did you see that?",
  vorm: { vraag: "Forms:", m: "he", v: "she", beide: "both" },
  verder: {
    begin: "Start with lesson 1",
    uitleg: "No account, no sign-up: just start.",
    dalej: "Continue with lesson {nr}",
    gedaan: "Lessons done: {n} of {totaal}",
    alles: "All lessons done. Congratulations!",
    overzicht: "All lessons",
  },
  grammatica: {
    naam: "Grammar",
    intro: "The forms and rules side by side, to look up once you know a little of the language. Words in bold are {taal}: click them to hear them.",
    groepen: {
      werkwoorden: "Verbs",
      naamwoorden: "Nouns and articles",
      voornaamwoorden: "Pronouns",
      zinsbouw: "Sentence structure",
      naamvallen: "Cases",
      verschil: "Differences from English",
    },
    anders: "Unlike in English",
    meer: "More about this:",
    inLessen: "In the lessons:",
    alle: "All grammar",
    uitspreken: "Listen",
    geen: "There are no topics yet.",
  },
  woorden: {
    naam: "Look up a word",
    intro: "Type a Dutch noun or verb. For a noun you see *de* or *het* and the plural, for a verb all its forms. The list has about {aantal} common words, up to roughly level B1.",
    zoek: "Look up a word",
    voorbeeld: "e.g. huis, lopen, liep",
    geen: "This word is not in the list.",
    suggesties: "Words that match",
    naamwoord: "Noun",
    werkwoord: "Verb",
    meervoud: "plural",
    geenMeervoud: "no plural",
    verkleinwoord: "diminutive",
    regelmatig: "regular",
    onregelmatig: "irregular",
    tt: "Present tense",
    vt: "Past tense",
    vd: "Perfect tense",
    hulp: {
      hebben: "With hebben.",
      zijn: "With zijn.",
      beide: "With hebben, or with zijn when you say where to: Ik heb gelopen. Ik ben naar huis gelopen.",
    },
    bron: "Source: {bron}",
  },
  speel: "Play",
  langzaam: "Slowly",
  luister: "Listen",
  zetOpVolgorde: "Put the words in order.",
  zegIn: "Say {taal}:",
  zegHardopIn: "Say aloud {taal}:",
  voorbeeld: "Example",
  controleer: "Check",
  volgende: "Next",
  nogEenKeer: "Once more",
  goed: "Correct!",
  bijvoorbeeld: "For example:",
  juist: "Correct:",
  spreek: "Speak",
  ikLuister: "Listening…",
  gehoord: "Heard:",
  bijna: "Almost. Try again ({n} left).",
  zonderMicrofoon: "Without a microphone",
  geenHerkenning: "This browser cannot listen along (Chrome, Edge and Safari can, over https).",
  zelfBeoordelen: "Listen to the example, say it aloud and judge for yourself.",
  gelukt: "Got it",
  nogNiet: "Not yet",
  vanGoed: "{score} of {totaal} correct.",
  zelfBeoordeeld: "{n} of them judged by yourself",
  score: "{score} of {totaal}",
  vorige: "Previous lesson",
  volgendeLes: "Next lesson",
};

export const TEKSTEN: Record<string, Teksten> = { nl, pl, en };

/** The interface languages the plugin has texts for. */
export const UI_TALEN = Object.keys(TEKSTEN);

export const teksten = (ui: string): Teksten => TEKSTEN[ui] ?? nl;

/** Whether the interface language has forms per learner (Polish: -łem/-łam), so the choice is worth showing. */
export const kentVormen = (ui: string): boolean => Object.values(teksten(ui)).some((v) => typeof v === "string" && heeftVormen(v));

/** Fill `{name}` placeholders. */
export const vul = (tekst: string, waarden: Record<string, string | number>): string =>
  tekst.replace(/\{(\w+)\}/g, (_, k: string) => String(waarden[k] ?? ""));
