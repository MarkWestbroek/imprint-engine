/**
 * Startup file for Plesk (Phusion Passenger). Passenger can't run
 * "npm run start"; it wants a single JS entry point that opens a port.
 * PORT is provided by Passenger; 3000 is the local fallback.
 *
 * Prerequisites on the server: `npm ci` + `npm run build` from the repo
 * root (see README, "Deploy naar Plesk").
 */
/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS on purpose: Passenger runs this file with bare node */
const { createServer } = require("node:http");
const next = require("next");

const port = Number(process.env.PORT) || 3000;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(handle).listen(port, () => {
    console.log(`musicbrain ready on port ${port}`);
  });
});
