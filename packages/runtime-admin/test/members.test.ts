import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AdminContext } from "../src/admin-context";
import { deleteOwnAccount, registerMember, requestPasswordReset, resetPasswordByToken, sendVerification } from "../src/admin-server/members";

/** The members' flows against a small fake instance: the codes, the site's own mails and paths, leaving. */

type Mail = { to: string; subject: string; text: string };

function fake(opts: { session?: { name: string; role: string } | null; staff?: boolean; mailer?: boolean } = {}) {
  const users = new Map<string, { name: string; email: string; password: string }>([["ewa", { name: "ewa", email: "ewa@example.test", password: "goed-wachtwoord-1" }]]);
  const sent: Mail[] = [];
  const removed: string[] = [];
  let signedOut = false;
  const admin = {
    auth: {
      getSession: async () => (opts.session === undefined ? { name: "ewa", role: "reader" } : opts.session),
      editingSession: async () => (opts.staff ? { name: "ewa", role: "editor" } : null),
      signOut: async () => {
        signedOut = true;
      },
    },
    imprint: {
      store: { getSiteConfig: async () => ({ name: "Langzaam maar zeker" }) },
      mail: opts.mailer === false ? null : { send: async (m: Mail) => void sent.push(m) },
      users: {
        get: async (name: string) => users.get(name) ?? null,
        getByEmail: async (email: string) => [...users.values()].find((u) => u.email === email) ?? null,
        register: async (name: string, email: string, password: string) => {
          if (users.has(name)) throw new Error(`User "${name}" already exists`);
          users.set(name, { name, email, password });
          return users.get(name);
        },
        verify: async (name: string, password: string) => (users.get(name)?.password === password ? users.get(name) : null),
        createEmailToken: async (_name: string, purpose: string) => `tok-${purpose}`,
        consumeEmailToken: async (token: string) => (token === "tok-reset" ? users.get("ewa") : null),
        setPassword: async (_name: string, password: string) => {
          if (password.length < 12) throw new Error("Password must be at least 12 characters");
        },
        remove: async (name: string) => {
          users.delete(name);
          removed.push(name);
        },
      },
    },
  } as unknown as AdminContext;
  return { admin, users, sent, removed, signedOut: () => signedOut };
}

describe("members: codes, the site's own mails and paths", () => {
  it("mails the verification link in Dutch to /account by default", async () => {
    const { admin, sent } = fake();
    assert.deepEqual(await registerMember(admin, { name: "jan", email: "jan@example.test", password: "goed-wachtwoord-1" }, { baseUrl: "https://x.test/" }), { ok: true });
    assert.match(sent[0]!.subject, /Bevestig je e-mailadres voor Langzaam maar zeker/);
    assert.match(sent[0]!.text, /https:\/\/x\.test\/account\/verify\?token=tok-verify/);
  });

  it("uses the site's path and text when given", async () => {
    const { admin, sent } = fake();
    const mail = { verify: ({ name, url }: { name: string; url: string }) => ({ subject: "Potwierdź", text: `Cześć ${name}: ${url}` }), reset: ({ url }: { url: string }) => ({ subject: "Nowe hasło", text: url }) };
    await sendVerification(admin, "ewa", "https://x.test", { accountPath: "/pl/account", mail });
    await requestPasswordReset(admin, "ewa@example.test", { baseUrl: "https://x.test", accountPath: "/pl/account", mail });
    assert.deepEqual(sent.map((m) => [m.subject, m.text]), [
      ["Potwierdź", "Cześć ewa: https://x.test/pl/account/verify?token=tok-verify"],
      ["Nowe hasło", "https://x.test/pl/account/reset?token=tok-reset"],
    ]);
  });

  it("says why with a code: the store's refusal, a stale link, a bot", async () => {
    const { admin, sent } = fake();
    const taken = await registerMember(admin, { name: "ewa", email: "e2@example.test", password: "goed-wachtwoord-1" }, { baseUrl: "https://x.test" });
    assert.deepEqual([taken.ok, taken.code, taken.error], [false, "rejected", 'User "ewa" already exists']);
    assert.equal((await resetPasswordByToken(admin, "oud", "goed-wachtwoord-1")).code, "stale-link");
    assert.equal((await resetPasswordByToken(admin, "tok-reset", "kort")).code, "rejected");
    assert.deepEqual(await resetPasswordByToken(admin, "tok-reset", "goed-wachtwoord-1"), { ok: true });
    assert.deepEqual(await registerMember(admin, { name: "bot", email: "b@example.test", password: "x", website: "http://spam" }, { baseUrl: "https://x.test" }), { ok: true });
    assert.equal(sent.length, 0, "no mail for a refusal or a bot");
    assert.deepEqual(await requestPasswordReset(admin, "onbekend@example.test", { baseUrl: "https://x.test" }), { ok: true }, "an unknown address answers the same");
  });
});

describe("members: leaving", () => {
  it("removes the account after the password, and signs out", async () => {
    const { admin, removed, signedOut } = fake();
    assert.equal((await deleteOwnAccount(admin, "fout")).code, "wrong-password");
    assert.deepEqual(removed, []);
    assert.deepEqual(await deleteOwnAccount(admin, "goed-wachtwoord-1"), { ok: true });
    assert.deepEqual(removed, ["ewa"]);
    assert.ok(signedOut());
  });

  it("is not for staff, nor without a session", async () => {
    assert.equal((await deleteOwnAccount(fake({ staff: true }).admin, "goed-wachtwoord-1")).code, "staff");
    assert.equal((await deleteOwnAccount(fake({ session: null }).admin, "goed-wachtwoord-1")).code, "not-signed-in");
  });
});
