/**
 * Settings shared by the e2e server script and the specs. The database is a
 * throwaway: `serve.ts` empties and reseeds it on every run, so its name must
 * end in `_e2e` — never point this at a database you care about.
 */
export const PORT = Number(process.env.E2E_PORT ?? 3200);
export const BASE_URL = `http://localhost:${PORT}`;

export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "mysql://imprint:imprint-dev@localhost:3306/imprint_e2e";

const dbName = new URL(DATABASE_URL).pathname.replace(/^\//, "");
if (!dbName.endsWith("_e2e")) {
  throw new Error(`E2E_DATABASE_URL must point at a *_e2e database (got "${dbName}")`);
}

/** Fixed, public test credentials — they only exist in the throwaway database. */
export const USERS = {
  admin: { name: "e2e-admin", password: "e2e-admin-password", role: "admin" },
  editor: { name: "e2e-editor", password: "e2e-editor-password", role: "editor" },
  reader: { name: "e2e-reader", password: "e2e-reader-password", role: "reader" },
} as const;

export type Role = keyof typeof USERS;

/** Bearer token for the write API in the test server; specs use it to plant content. */
export const INGEST_TOKEN = "e2e-ingest-token";

/** Where the signed-in browser state of a role is kept between specs. */
export const authFile = (role: Role) => `e2e/.auth/${role}.json`;
