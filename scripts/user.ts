import "dotenv/config";

import { createDb } from "@imprint/content-core/db-store";
import { DbUserStore } from "@imprint/content-core/user-store";
import { generatePassword } from "@imprint/content-core/passwords";
import { RoleType } from "@imprint/content-core";

/**
 * User administration from the command line — the way back in when nobody can
 * reach /admin/users any more (forgotten admin password, last admin deleted).
 * Runs wherever DATABASE_URL points, so on Plesk that means over SSH from the
 * app directory. Same DbUserStore as the admin UI, so the last-admin guard and
 * the password policy apply here too.
 */

const USAGE = `Usage: npm run user -- <command>

  list                              show all users and their roles
  add <name> [role] [password]      add a user (role defaults to editor)
  passwd <name> [password]          set a new password
  role <name> <admin|editor|reader> change someone's role
  delete <name>                     remove a user

Leave [password] out and one is generated and printed once — that avoids
putting a password in your shell history. Roles: admin (may manage users),
editor (may edit content), reader (no write access).`;

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (create .env from .env.example)");

  const db = createDb(url);
  const users = new DbUserStore(db);

  try {
    switch (command) {
      case "list": {
        const all = await users.list();
        if (all.length === 0) {
          console.log("No users yet — run `npm run db:seed` with SEED_ADMIN_PASSWORD set.");
          break;
        }
        for (const user of all) console.log(`${user.name.padEnd(24)} ${user.role}`);
        break;
      }

      case "add": {
        const [name, role = "editor", given] = args;
        if (!name) throw new Error("add needs a username");
        const password = given ?? generatePassword();
        await users.create(name, password, RoleType.parse(role));
        console.log(`✓ added ${name} (${role})`);
        if (!given) console.log(`  password: ${password}`);
        break;
      }

      case "passwd": {
        const [name, given] = args;
        if (!name) throw new Error("passwd needs a username");
        const password = given ?? generatePassword();
        await users.setPassword(name, password);
        console.log(`✓ new password set for ${name}`);
        if (!given) console.log(`  password: ${password}`);
        console.log("  Sessions stay valid for up to 12h; sign out to end them now.");
        break;
      }

      case "role": {
        const [name, role] = args;
        if (!name || !role) throw new Error("role needs a username and a role");
        await users.setRole(name, RoleType.parse(role));
        console.log(`✓ ${name} is now ${role}`);
        break;
      }

      case "delete": {
        const [name] = args;
        if (!name) throw new Error("delete needs a username");
        await users.remove(name);
        console.log(`✓ deleted ${name}`);
        break;
      }

      default:
        console.log(USAGE);
        process.exitCode = command ? 1 : 0;
    }
  } finally {
    await db.$client.end();
  }
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
