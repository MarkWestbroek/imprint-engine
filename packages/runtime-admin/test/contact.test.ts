import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AdminContext } from "../src/admin-context";
import { sendContactMessage } from "../src/admin-server/contact";

type Mail = { to: string; subject: string; text: string; replyTo?: string };

function fake(mailer = true) {
  const sent: Mail[] = [];
  const admin = {
    imprint: {
      store: { getSiteConfig: async () => ({ name: "Langzaam maar zeker" }) },
      mail: mailer ? { send: async (m: Mail) => void sent.push(m) } : null,
    },
  } as unknown as AdminContext;
  return { admin, sent };
}

describe("the contact form", () => {
  it("mails the message to the owner, with the sender as Reply-To", async () => {
    const { admin, sent } = fake();
    const r = await sendContactMessage(admin, { name: "Ewa", email: "ewa@example.test", message: "  Les 3 heeft een fout.  ", page: "/pl/kontakt" }, { to: "owner@example.test" });
    assert.deepEqual(r, { ok: true });
    assert.equal(sent[0]!.to, "owner@example.test");
    assert.equal(sent[0]!.replyTo, "ewa@example.test");
    assert.match(sent[0]!.text, /Les 3 heeft een fout\.\n/);
    assert.match(sent[0]!.text, /Naam: Ewa/);
  });

  it("works without a name or an address, then without Reply-To", async () => {
    const { admin, sent } = fake();
    await sendContactMessage(admin, { message: "Dank!" }, { to: "owner@example.test" });
    assert.equal(sent[0]!.replyTo, undefined);
    assert.match(sent[0]!.text, /antwoorden kan niet/);
  });

  it("refuses an empty or too long message and a wrong address; a bot gets 'ok' and no mail", async () => {
    const { admin, sent } = fake();
    assert.equal((await sendContactMessage(admin, { message: "   " }, { to: "o@x.test" })).code, "empty");
    assert.equal((await sendContactMessage(admin, { message: "x".repeat(5001) }, { to: "o@x.test" })).code, "too-long");
    assert.equal((await sendContactMessage(admin, { message: "Hoi", email: "ewa\nBcc: x@y.z" }, { to: "o@x.test" })).code, "bad-address");
    assert.deepEqual(await sendContactMessage(admin, { message: "spam", website: "http://spam" }, { to: "o@x.test" }), { ok: true });
    assert.equal(sent.length, 0);
  });

  it("limits the messages per IP", async () => {
    const { admin } = fake();
    const codes = [];
    for (let i = 0; i < 7; i++) codes.push((await sendContactMessage(admin, { message: "Hoi" }, { to: "o@x.test", ip: "203.0.113.9" })).code);
    assert.deepEqual(codes.slice(5), ["rate-limited", "rate-limited"]);
  });
});
