import type { ContactErrorCode } from "@imprint/runtime-admin/admin-server";

/**
 * The words of the contact form (widget `contact`) per language: the labels
 * in the form and the messages the server action answers with. A plain
 * module, so the client form and the server action share it.
 */
export const CONTACT_TALEN = ["nl", "pl"] as const;
export type ContactTaal = (typeof CONTACT_TALEN)[number];

export const contactTaal = (value: unknown): ContactTaal => (CONTACT_TALEN.includes(value as ContactTaal) ? (value as ContactTaal) : "nl");

type Teksten = {
  naam: string;
  email: string;
  emailHint: string;
  bericht: string;
  verstuur: string;
  bezig: string;
  verstuurd: string;
  nogEen: string;
  fout: Record<ContactErrorCode, string>;
};

export const CONTACT_TEKSTEN: Record<ContactTaal, Teksten> = {
  nl: {
    naam: "Naam",
    email: "E-mailadres",
    emailHint: "Zodat ik je kan antwoorden. Liever gebeld worden? Zet je nummer in het bericht.",
    bericht: "Bericht",
    verstuur: "Verstuur",
    bezig: "Bezig…",
    verstuurd: "Je bericht is verstuurd. Ik neem contact met je op.",
    nogEen: "Nog een bericht sturen",
    fout: {
      empty: "Schrijf een bericht.",
      "too-long": "Het bericht is te lang (hoogstens 5000 tekens).",
      "bad-address": "Dat is geen e-mailadres.",
      "rate-limited": "Te veel berichten; probeer het over tien minuten nog eens.",
      "no-mail": "Het contactformulier werkt nog niet.",
      failed: "Versturen lukte niet; probeer het nog eens.",
    },
  },
  pl: {
    naam: "Imię i nazwisko",
    email: "Adres e-mail",
    emailHint: "Żebym mógł odpowiedzieć. Wolisz rozmowę telefoniczną? Podaj numer w wiadomości.",
    bericht: "Wiadomość",
    verstuur: "Wyślij",
    bezig: "Wysyłanie…",
    verstuurd: "Wiadomość została wysłana. Skontaktuję się z Tobą.",
    nogEen: "Wyślij kolejną wiadomość",
    fout: {
      empty: "Napisz wiadomość.",
      "too-long": "Wiadomość jest za długa (najwyżej 5000 znaków).",
      "bad-address": "To nie jest adres e-mail.",
      "rate-limited": "Za dużo wiadomości; spróbuj ponownie za dziesięć minut.",
      "no-mail": "Formularz kontaktowy jeszcze nie działa.",
      failed: "Nie udało się wysłać; spróbuj ponownie.",
    },
  },
};
