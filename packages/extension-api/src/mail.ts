import nodemailer from "nodemailer";

/**
 * Outbound mail (design/mail.md): one SMTP relay per instance, read from the
 * environment in imprint.config.ts. Without a host or a sender there is no
 * mailer, and whatever needs one says so (rule 3: no mail configured = a
 * clear message, never a silently dropped message).
 */
export type MailConfig = {
  host?: string;
  port?: number;
  /** TLS from the start (port 465); false = STARTTLS where offered. */
  secure?: boolean;
  user?: string;
  pass?: string;
  /** "Common Ground <noreply@example.org>" — the domain, never the visitor (rule 1). */
  from?: string;
};

export type MailMessage = { to: string; subject: string; text: string; html?: string; replyTo?: string };

export interface Mailer {
  from: string;
  send(message: MailMessage): Promise<void>;
}

/** The mailer for a config, or null when host or sender is missing. */
export function createMailer(config: MailConfig | undefined): Mailer | null {
  if (!config?.host || !config.from) return null;
  const port = config.port ?? 465;
  const transport = nodemailer.createTransport({
    host: config.host,
    port,
    secure: config.secure ?? port === 465,
    auth: config.user ? { user: config.user, pass: config.pass ?? "" } : undefined,
  });
  const from = config.from;
  return {
    from,
    async send(message) {
      await transport.sendMail({ from, ...message });
    },
  };
}
