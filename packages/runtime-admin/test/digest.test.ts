import assert from "node:assert/strict";
import { test } from "node:test";
import { composeDigest, sendDigests } from "../src/admin-server/digest";

const items = [
  { title: "ed beantwoordde je reactie", href: "/blog/x", createdAt: new Date("2026-10-02T08:00:00Z") },
  { title: "ed schreef in Atlas: Hoi", href: "/groups/atlas", createdAt: new Date("2026-10-02T09:00:00Z") },
];

test("composeDigest: subject counts, every item links absolutely, the inbox and the unsubscribe link are there", () => {
  const mail = composeDigest({ siteName: "Common Ground", baseUrl: "https://cg.example/", user: { name: "ann" }, items, inboxPath: "/account/notifications", unsubscribeUrl: "https://cg.example/account/digest?token=t" });
  assert.equal(mail.subject, "Common Ground: 2 nieuwe mededelingen");
  assert.match(mail.text, /^Hallo ann,/);
  assert.match(mail.text, /- ed beantwoordde je reactie\n  https:\/\/cg\.example\/blog\/x/);
  assert.match(mail.text, /https:\/\/cg\.example\/account\/notifications/);
  assert.match(mail.text, /account\/digest\?token=t/);
  assert.equal(composeDigest({ siteName: "S", baseUrl: "https://s", user: { name: "a" }, items: items.slice(0, 1), inboxPath: "/i", unsubscribeUrl: "u" }).subject, "S: 1 nieuwe mededeling");
});

test("sendDigests: one mail per member who wants it; the rest is marked mailed without a mail; dry run touches nothing", async () => {
  const sent: { to: string; subject: string }[] = [];
  const mailedIds: number[] = [];
  const digests: Record<string, string> = { ann: "daily", ed: "off", bo: "daily" };
  const users = {
    unmailedNotifications: async () => [
      { id: 1, userName: "ann", kind: "reply", title: "t1", href: "/a", actor: "ed", createdAt: new Date(), readAt: null, mailedAt: null },
      { id: 2, userName: "ann", kind: "post", title: "t2", href: "/b", actor: "ed", createdAt: new Date(), readAt: null, mailedAt: null },
      { id: 3, userName: "ed", kind: "post", title: "t3", href: "/c", actor: "ann", createdAt: new Date(), readAt: null, mailedAt: null },
      { id: 4, userName: "bo", kind: "post", title: "t4", href: "/d", actor: "ann", createdAt: new Date(), readAt: null, mailedAt: null },
    ],
    get: async (name: string) => ({ id: 1, name, role: "reader", email: name === "bo" ? null : `${name}@x`, emailVerified: true, digest: digests[name] }),
    createEmailToken: async () => "tok",
    markMailedNotifications: async (ids: number[]) => void mailedIds.push(...ids),
  };
  const admin = {
    imprint: {
      users,
      mail: { from: "x", send: async (m: { to: string; subject: string }) => void sent.push({ to: m.to, subject: m.subject }) },
      store: { getSiteConfig: async () => ({ name: "Site", baseUrl: "https://s" }) },
    },
  } as never;
  const dry = await sendDigests(admin, { baseUrl: "https://s", dryRun: true });
  assert.deepEqual([dry.mailed, dry.skipped, dry.items, sent.length, mailedIds.length], [1, 2, 4, 0, 0]);
  const report = await sendDigests(admin, { baseUrl: "https://s" });
  assert.deepEqual([report.mailed, report.skipped, report.items], [1, 2, 4]);
  assert.deepEqual(sent, [{ to: "ann@x", subject: "Site: 2 nieuwe mededelingen" }]);
  assert.deepEqual([...mailedIds].sort(), [1, 2, 3, 4], "off and no-address members are marked too, so nothing piles up");
});
