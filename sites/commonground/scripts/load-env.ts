import { config } from "dotenv";

/** The site's .env.local first (DATABASE_URL, SESSION_SECRET), then .env; imported before anything reads them. */
config({ path: ".env.local", quiet: true });
config({ quiet: true });
