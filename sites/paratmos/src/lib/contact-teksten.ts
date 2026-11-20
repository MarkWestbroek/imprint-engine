import type { ContactErrorCode } from "@imprint/runtime-admin/admin-server";

/**
 * The words of the contact form (widget `contact`) per language: the labels
 * in the form and the messages the server action answers with. A plain
 * module, so the client form and the server action share it.
 */
export const CONTACT_TALEN = ["nl", "en"] as const;
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
  en: {
    naam: "Name",
    email: "Email address",
    emailHint: "So I can reply. Prefer a call? Put your number in the message.",
    bericht: "Message",
    verstuur: "Send",
    bezig: "Sending…",
    verstuurd: "Your message has been sent. I will get back to you.",
    nogEen: "Send another message",
    fout: {
      empty: "Please write a message.",
      "too-long": "The message is too long (5000 characters at most).",
      "bad-address": "That is not an email address.",
      "rate-limited": "Too many messages; please try again in ten minutes.",
      "no-mail": "The contact form does not work yet.",
      failed: "Sending failed; please try again.",
    },
  },
};
