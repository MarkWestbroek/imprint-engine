import type { AdminContext } from "../admin-context";
import { rateLimited } from "./members";

/**
 * A contact form: the message goes by mail to the site's owner, and is not
 * stored. Who writes may leave a name and an address (for an answer: the
 * mail's Reply-To), or neither. The owner's address is the site's to give
 * (an environment variable), never in the page. Spam: a honeypot field and
 * the per-IP limit of members.ts.
 */
export type ContactErrorCode = "empty" | "too-long" | "bad-address" | "rate-limited" | "no-mail" | "failed";
export type ContactResult = { ok: boolean; code?: ContactErrorCode; error?: string };

export const CONTACT_MAX = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendContactMessage(
  admin: AdminContext,
  input: { name?: string; email?: string; message: string; website?: string; page?: string },
  opts: { to?: string; ip?: string }
): Promise<ContactResult> {
  // The honeypot: a real visitor never sees the field. Pretend it worked.
  if (input.website) return { ok: true };
  const message = input.message.trim();
  if (!message) return { ok: false, code: "empty", error: "Schrijf een bericht." };
  if (message.length > CONTACT_MAX) return { ok: false, code: "too-long", error: `Het bericht is te lang (hoogstens ${CONTACT_MAX} tekens).` };
  const email = (input.email ?? "").trim();
  if (email && !EMAIL_RE.test(email)) return { ok: false, code: "bad-address", error: "Dat is geen e-mailadres." };
  if (opts.ip && rateLimited(opts.ip, "contact")) return { ok: false, code: "rate-limited", error: "Te veel berichten; probeer het over tien minuten nog eens." };

  const site = await admin.imprint.store.getSiteConfig();
  const name = (input.name ?? "").trim().slice(0, 100);
  const text = [
    `Bericht via het contactformulier van ${site.name}:`,
    "",
    message,
    "",
    "--",
    `Naam: ${name || "(niet ingevuld)"}`,
    `E-mail: ${email || "(niet ingevuld: antwoorden kan niet)"}`,
    ...(input.page ? [`Pagina: ${input.page}`] : []),
  ].join("\n");

  const mailer = admin.imprint.mail;
  if (!mailer || !opts.to) {
    if (process.env.NODE_ENV === "production") return { ok: false, code: "no-mail", error: "Het contactformulier werkt nog niet." };
    console.info(`[contact] no mailer or no recipient; the message:\n${text}`);
    return { ok: true };
  }
  try {
    await mailer.send({ to: opts.to, subject: `Contactformulier ${site.name}`, text, replyTo: email || undefined });
  } catch (err) {
    console.error("[contact] sending failed", err);
    return { ok: false, code: "failed", error: "Versturen lukte niet; probeer het nog eens." };
  }
  return { ok: true };
}
