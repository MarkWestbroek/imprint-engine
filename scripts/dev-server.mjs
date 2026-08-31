#!/usr/bin/env node
/**
 * Dev-server-beheer: start / stop / restart / status.
 *
 * `next dev` blijft in de terminal draaien waarin je hem start, en dat is
 * precies het lastige moment: een build-error of een gewijzigde dependency
 * vraagt om een herstart, maar de server hangt in een ander venster (of in
 * een VS Code-task). Dit script praat daarom niet met een proceshandle maar
 * met de *poort*: wie op PORT luistert, is de dev-server.
 *
 *   npm run dev:status    — draait er iets, en wat?
 *   npm run dev:stop      — netjes afsluiten (SIGTERM, daarna SIGKILL)
 *   npm run dev:restart   — stop + start in de achtergrond, log naar .next-dev.log
 *   npm run dev           — onveranderd: in de voorgrond, logs in beeld
 */

import { spawn, execFileSync } from "node:child_process";
import { openSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT || "3000";
const LOG = path.join(root, ".next-dev.log");

/** PIDs die op PORT luisteren (leeg = server draait niet). */
function listeners() {
  try {
    const out = execFileSync("lsof", ["-ti", `tcp:${PORT}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
    });
    return out.split("\n").filter(Boolean).map(Number);
  } catch {
    return []; // lsof geeft exit 1 als niemand luistert
  }
}

function describe(pid) {
  try {
    return execFileSync("ps", ["-o", "command=", "-p", String(pid)], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "(onbekend proces)";
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function stop() {
  const pids = listeners();
  if (pids.length === 0) {
    console.log(`Geen dev-server op poort ${PORT}.`);
    return;
  }
  for (const pid of pids) {
    console.log(`Stoppen: pid ${pid} — ${describe(pid)}`);
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* al weg */
    }
  }
  // Next krijgt vijf seconden om zijn workers op te ruimen; daarna hard.
  for (let i = 0; i < 25 && listeners().length > 0; i++) await sleep(200);
  for (const pid of listeners()) {
    console.log(`Reageert niet, SIGKILL: pid ${pid}`);
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* al weg */
    }
  }
  await sleep(200);
  console.log(`Poort ${PORT} is vrij.`);
}

/** Start losgekoppeld van deze shell, met de logs in .next-dev.log. */
function start() {
  const fd = openSync(LOG, "a");
  const child = spawn("npm", ["run", "dev"], {
    cwd: root,
    detached: true,
    stdio: ["ignore", fd, fd],
    env: { ...process.env, PORT },
  });
  child.unref();
  console.log(`Dev-server gestart (pid ${child.pid}) op http://localhost:${PORT}`);
  console.log(`Logs: tail -f ${path.relative(root, LOG)}`);
}

function status() {
  const pids = listeners();
  if (pids.length === 0) {
    console.log(`Geen dev-server op poort ${PORT}.`);
    return;
  }
  for (const pid of pids) console.log(`pid ${pid} — ${describe(pid)}`);
  console.log(`http://localhost:${PORT}`);
}

const cmd = process.argv[2] ?? "status";
if (cmd === "stop") await stop();
else if (cmd === "start") start();
else if (cmd === "restart") {
  await stop();
  start();
} else if (cmd === "status") status();
else {
  console.error(`Onbekend commando: ${cmd} (start|stop|restart|status)`);
  process.exit(1);
}
