import type { MemberErrorCode, MemberMailText } from "@imprint/runtime-admin/admin-server";

/**
 * The texts of the account pages, per interface language (the first segment
 * of the address, as with the lessons). Plain data plus the two mails; the
 * client parts read it too, so nothing here may import the server's config.
 *
 * The Polish texts are a first translation: to be read by a Polish speaker.
 */
export type AccountTeksten = {
  inloggen: string;
  registreren: string;
  account: string;
  uitloggen: string;
  wachtwoordVergeten: string;
  nieuwWachtwoord: string;
  privacy: string;
  naam: string;
  naamHint: string;
  email: string;
  wachtwoord: string;
  herhaal: string;
  wachtwoordHint: string;
  nietGelijk: string;
  oog: [string, string];
  naamOfEmail: string;
  bezig: string;
  maakAccount: string;
  waarom: string;
  alAccount: string;
  nogGeenAccount: string;
  bijnaKlaar: string;
  zonderMail: string;
  stuurLink: string;
  linkVerstuurd: string;
  opslaan: string;
  gewijzigd: string;
  alleenViaLink: string;
  nieuweLink: string;
  bevestigd: string;
  nietBevestigdLink: string;
  nogNietBevestigd: string;
  opnieuwSturen: string;
  verstuurd: string;
  geen: string;
  lessenGedaan: string;
  naarLessen: string;
  naarAdmin: string;
  verwijderen: string;
  verwijderUitleg: string;
  verwijderKnop: string;
  verwijderd: string;
  privacyTekst: string;
  fout: Record<MemberErrorCode | "algemeen" | "naamBestaat" | "naamOngeldig" | "emailBestaat" | "emailOngeldig" | "wachtwoordKort", string>;
  mail: { verify: MemberMailText; reset: MemberMailText };
};

const pl: AccountTeksten = {
  inloggen: "Zaloguj się",
  registreren: "Załóż konto",
  account: "Moje konto",
  uitloggen: "Wyloguj się",
  wachtwoordVergeten: "Nie pamiętasz hasła?",
  nieuwWachtwoord: "Nowe hasło",
  privacy: "Prywatność",
  naam: "Nazwa użytkownika",
  naamHint: "Litery, cyfry, kropka, myślnik lub podkreślenie.",
  email: "Adres e-mail",
  wachtwoord: "Hasło",
  herhaal: "Powtórz hasło",
  wachtwoordHint: "Co najmniej 12 znaków.",
  nietGelijk: "Hasła nie są takie same.",
  oog: ["Pokaż hasło", "Ukryj hasło"],
  naamOfEmail: "Nazwa użytkownika lub adres e-mail",
  bezig: "Chwileczkę…",
  maakAccount: "Załóż konto",
  waarom:
    "Konto nie jest potrzebne: wszystkie lekcje działają bez niego. Z kontem twoje wyniki i wybór form (on/ona) są zapisane także na innym telefonie lub komputerze. Adresu e-mail używamy tylko do potwierdzenia konta i do zmiany hasła.",
  alAccount: "Masz już konto?",
  nogGeenAccount: "Nie masz jeszcze konta?",
  bijnaKlaar: "Prawie gotowe. Wysłaliśmy ci e-mail z linkiem do potwierdzenia adresu (ważny 24 godziny). Możesz się już zalogować.",
  zonderMail: "Środowisko testowe bez poczty:",
  stuurLink: "Wyślij mi link",
  linkVerstuurd: "Jeśli znamy ten adres, wysłaliśmy na niego e-mail z linkiem do ustawienia nowego hasła (ważny 2 godziny).",
  opslaan: "Zapisz hasło",
  gewijzigd: "Hasło zostało zmienione.",
  alleenViaLink: "Ta strona działa tylko przez link z e-maila.",
  nieuweLink: "Poproś o nowy link",
  bevestigd: "Adres e-mail został potwierdzony. Witamy!",
  nietBevestigdLink: "Ten link jest nieznany, już użyty albo wygasł.",
  nogNietBevestigd: "jeszcze niepotwierdzony",
  opnieuwSturen: "Wyślij e-mail potwierdzający jeszcze raz",
  verstuurd: "Wysłano.",
  geen: "brak",
  lessenGedaan: "Ukończone lekcje: {n}",
  naarLessen: "Do lekcji",
  naarAdmin: "Do panelu redakcji",
  verwijderen: "Usuń konto",
  verwijderUitleg: "Usuwamy konto i wszystko, co o tobie przechowujemy: nazwę, adres e-mail, wyniki i wybór form. Tego nie da się cofnąć.",
  verwijderKnop: "Usuń moje konto",
  verwijderd: "Konto zostało usunięte.",
  privacyTekst: `## Bez konta

Lekcje działają bez konta. Twoje wyniki i wybór form (on/ona) są wtedy zapisane tylko w twojej przeglądarce. My ich nie widzimy.

## Z kontem

Jeśli założysz konto, przechowujemy:

- nazwę użytkownika i adres e-mail;
- hasło, tylko w postaci zaszyfrowanej (skrótu);
- najlepszy wynik każdej lekcji i wybór form (on/ona).

Adresu e-mail używamy tylko do potwierdzenia konta i do zmiany hasła. Nie wysyłamy reklam i nie przekazujemy twoich danych nikomu.

## Pliki cookie

Po zalogowaniu używamy jednego pliku cookie, żeby cię rozpoznać. Nie używamy plików cookie do reklam ani do śledzenia.

## Statystyki odwiedzin

Serwer zapisuje, które strony są odwiedzane (z adresem IP), żeby liczyć odwiedziny. Tych danych nie łączymy z twoim kontem.

## Usunięcie konta

Konto możesz usunąć sam{|a} na stronie „Moje konto”. Usuwamy wtedy wszystko, co o tobie przechowujemy.`,
  fout: {
    algemeen: "Nie udało się. Spróbuj jeszcze raz.",
    "no-database": "To teraz nie działa. Spróbuj później.",
    "rate-limited": "Za dużo prób. Spróbuj ponownie za dziesięć minut.",
    rejected: "Nie udało się. Sprawdź dane i spróbuj jeszcze raz.",
    "no-address": "Nie znamy adresu e-mail.",
    "no-mail": "Poczta na tej stronie jeszcze nie działa.",
    "stale-link": "Ten link jest nieznany, już użyty albo wygasł.",
    "bad-login": "Nieznana nazwa lub adres e-mail, albo złe hasło.",
    "not-signed-in": "Najpierw się zaloguj.",
    staff: "Konto redakcji usuwa się w panelu redakcji.",
    "wrong-password": "Hasło się nie zgadza.",
    naamBestaat: "Ta nazwa użytkownika jest już zajęta.",
    naamOngeldig: "Nazwa użytkownika: 2–64 znaki, tylko litery, cyfry, kropka, myślnik lub podkreślenie.",
    emailBestaat: "Ten adres e-mail ma już konto.",
    emailOngeldig: "To nie jest adres e-mail.",
    wachtwoordKort: "Hasło musi mieć co najmniej 12 znaków.",
  },
  mail: {
    verify: ({ name, site, url }) => ({
      subject: `Potwierdź swój adres e-mail – ${site}`,
      text:
        `Cześć ${name},\n\nPotwierdź swój adres e-mail na stronie ${site} tym linkiem (ważny 24 godziny):\n\n${url}\n\n` +
        `To nie ty? Zignoruj tę wiadomość.\n`,
    }),
    reset: ({ name, site, url }) => ({
      subject: `Nowe hasło – ${site}`,
      text:
        `Cześć ${name},\n\nUstaw nowe hasło na stronie ${site} tym linkiem (ważny 2 godziny):\n\n${url}\n\n` +
        `To nie ty? Zignoruj tę wiadomość; twoje hasło zostaje bez zmian.\n`,
    }),
  },
};

const nl: AccountTeksten = {
  inloggen: "Inloggen",
  registreren: "Account maken",
  account: "Mijn account",
  uitloggen: "Uitloggen",
  wachtwoordVergeten: "Wachtwoord vergeten?",
  nieuwWachtwoord: "Nieuw wachtwoord",
  privacy: "Privacy",
  naam: "Gebruikersnaam",
  naamHint: "Letters, cijfers, punt, streepje of underscore.",
  email: "E-mailadres",
  wachtwoord: "Wachtwoord",
  herhaal: "Herhaal wachtwoord",
  wachtwoordHint: "Minstens 12 tekens.",
  nietGelijk: "De twee wachtwoorden zijn niet gelijk.",
  oog: ["Wachtwoord tonen", "Wachtwoord verbergen"],
  naamOfEmail: "Gebruikersnaam of e-mailadres",
  bezig: "Bezig…",
  maakAccount: "Account maken",
  waarom:
    "Een account is niet nodig: alle lessen werken zonder. Met een account staan je resultaten en je keuze van vormen ook op een andere telefoon of computer. Je e-mailadres gebruiken we alleen om je account te bevestigen en voor een nieuw wachtwoord.",
  alAccount: "Al een account?",
  nogGeenAccount: "Nog geen account?",
  bijnaKlaar: "Bijna klaar. We hebben je een e-mail gestuurd met een link om je adres te bevestigen (24 uur geldig). Je kunt al inloggen.",
  zonderMail: "Testomgeving zonder mail:",
  stuurLink: "Stuur mij een link",
  linkVerstuurd: "Als dit adres bij ons bekend is, hebben we er een mail heen gestuurd met een link om een nieuw wachtwoord te kiezen (2 uur geldig).",
  opslaan: "Wachtwoord opslaan",
  gewijzigd: "Je wachtwoord is gewijzigd.",
  alleenViaLink: "Deze pagina werkt alleen via de link uit de mail.",
  nieuweLink: "Vraag een nieuwe link aan",
  bevestigd: "Je e-mailadres is bevestigd. Welkom!",
  nietBevestigdLink: "Deze link is onbekend, al gebruikt of verlopen.",
  nogNietBevestigd: "nog niet bevestigd",
  opnieuwSturen: "Bevestigingsmail opnieuw sturen",
  verstuurd: "Verstuurd.",
  geen: "geen",
  lessenGedaan: "Lessen gedaan: {n}",
  naarLessen: "Naar de lessen",
  naarAdmin: "Naar de admin",
  verwijderen: "Account verwijderen",
  verwijderUitleg: "We verwijderen je account en alles wat we over je bewaren: je naam, je e-mailadres, je resultaten en je keuze van vormen. Dit kan niet ongedaan worden gemaakt.",
  verwijderKnop: "Verwijder mijn account",
  verwijderd: "Je account is verwijderd.",
  privacyTekst: `## Zonder account

De lessen werken zonder account. Je resultaten en je keuze van vormen staan dan alleen in je eigen browser. Wij zien ze niet.

## Met een account

Als je een account maakt, bewaren we:

- je gebruikersnaam en je e-mailadres;
- je wachtwoord, alleen versleuteld (als hash);
- je beste resultaat per les en je keuze van vormen.

Je e-mailadres gebruiken we alleen om je account te bevestigen en voor een nieuw wachtwoord. We sturen geen reclame en geven je gegevens aan niemand door.

## Cookies

Als je inlogt, gebruiken we één cookie om je te herkennen. We gebruiken geen cookies voor reclame of om je te volgen.

## Bezoekstatistiek

De server houdt bij welke pagina's worden bezocht (met het IP-adres), om bezoeken te tellen. Die gegevens koppelen we niet aan je account.

## Account verwijderen

Je kunt je account zelf verwijderen op de pagina "Mijn account". We verwijderen dan alles wat we over je bewaren.`,
  fout: {
    algemeen: "Dat lukte niet. Probeer het nog eens.",
    "no-database": "Dit werkt nu niet. Probeer het later nog eens.",
    "rate-limited": "Te veel pogingen; probeer het over tien minuten nog eens.",
    rejected: "Dat lukte niet. Controleer wat je hebt ingevuld.",
    "no-address": "Geen e-mailadres bekend.",
    "no-mail": "Mail is op deze site nog niet ingesteld.",
    "stale-link": "Deze link is onbekend, al gebruikt of verlopen.",
    "bad-login": "Onbekende combinatie van naam of e-mailadres en wachtwoord.",
    "not-signed-in": "Log eerst in.",
    staff: "Een redactie-account verwijder je via de admin.",
    "wrong-password": "Het wachtwoord klopt niet.",
    naamBestaat: "Deze gebruikersnaam is al bezet.",
    naamOngeldig: "Gebruikersnaam: 2 tot 64 tekens, alleen letters, cijfers, punt, streepje of underscore.",
    emailBestaat: "Dit e-mailadres heeft al een account.",
    emailOngeldig: "Dat is geen e-mailadres.",
    wachtwoordKort: "Het wachtwoord moet minstens 12 tekens hebben.",
  },
  mail: {
    verify: ({ name, site, url }) => ({
      subject: `Bevestig je e-mailadres voor ${site}`,
      text:
        `Hallo ${name},\n\nBevestig je e-mailadres voor ${site} met deze link (24 uur geldig):\n\n${url}\n\n` +
        `Heb je je niet aangemeld? Dan kun je dit bericht negeren.\n`,
    }),
    reset: ({ name, site, url }) => ({
      subject: `Nieuw wachtwoord voor ${site}`,
      text:
        `Hallo ${name},\n\nKies met deze link een nieuw wachtwoord voor ${site} (2 uur geldig):\n\n${url}\n\n` +
        `Heb je dit niet aangevraagd? Dan kun je dit bericht negeren; je wachtwoord blijft zoals het was.\n`,
    }),
  },
};

export const ACCOUNT: Record<string, AccountTeksten> = { pl, nl };

/** The languages the account pages exist in; the first is the default (as in imprint.config.ts). */
export const isUi = (ui: string): boolean => Object.hasOwn(ACCOUNT, ui);

/** The interface language of a request: one this site offers, else the default. */
export const uiVan = (value: unknown): string => (isUi(String(value)) ? String(value) : "pl");

export const accountTeksten = (ui: string): AccountTeksten => ACCOUNT[uiVan(ui)]!;

export const accountPad = (ui: string, pagina = ""): string => `/${uiVan(ui)}/account${pagina ? `/${pagina}` : ""}`;

/** The sentence for a failed member action, in the language of the site. */
export function foutTekst(result: { code?: MemberErrorCode; error?: string }, t: AccountTeksten): string {
  if (result.code !== "rejected") return t.fout[result.code ?? "algemeen"];
  // The user store says why in English; these are its sentences (user-store-base.ts, passwords.ts).
  const waarom = result.error ?? "";
  if (/already registered/.test(waarom)) return t.fout.emailBestaat;
  if (/not an e-mail/.test(waarom)) return t.fout.emailOngeldig;
  if (/already exists/.test(waarom)) return t.fout.naamBestaat;
  if (/^Username/.test(waarom)) return t.fout.naamOngeldig;
  if (/password/i.test(waarom)) return t.fout.wachtwoordKort;
  return t.fout.rejected;
}
