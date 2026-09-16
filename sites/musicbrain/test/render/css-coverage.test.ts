import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { promisify } from "node:util";

/**
 * CSS coverage of the rendered HTML (architecture.md §8). The golden HTML
 * pins which classes the renderer and the viewers emit; this checks that the
 * site's Tailwind build generates CSS for every one of them.
 *
 * Method: build the CSS as configured (test/ excluded from the scan) and with
 * the golden HTML scanned as well. Test code stays excluded in both, or
 * class-like strings in tests would count. If the golden HTML contains a
 * class that no scanned source provides, only the second build emits CSS for
 * it and the two differ.
 * That is exactly what happens when viewers move into an engine package and
 * nobody adds its `@source` line to globals.css.
 *
 * Every build runs in its own Node process: @tailwindcss/postcss caches per
 * input file, so a second build in the same process silently returns the
 * first result — and this guard would never fail. The sensitivity test below
 * keeps that from creeping back in.
 */

const SITE = path.resolve(import.meta.dirname, "../..");
const CSS_FILE = path.join(SITE, "src/app/globals.css");
const EXCLUDE_TEST = '@source not "../../test";';
/** Scans test/ except test code, i.e. the golden HTML (verified: a positive
 *  @source inside an excluded folder does not win from the exclusion). */
const EXCLUDE_TEST_CODE = '@source not "../../test/**/*.{ts,tsx}";';
const execFileAsync = promisify(execFile);

/** Runs in a fresh process: `node --input-type=module -e <script> <site> <variant> [dir]`. */
const BUILD_SCRIPT = `
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const [site, variant, extraDir] = process.argv.slice(1);
const require = createRequire(site + "/package.json");
const postcss = require("postcss");
const tw = require("@tailwindcss/postcss");
const tailwind = tw.default ?? tw;
const from = site + "/src/app/globals.css";
let css = readFileSync(from, "utf8");
if (variant === "with-goldens") css = css.replace(${JSON.stringify(EXCLUDE_TEST)}, ${JSON.stringify(EXCLUDE_TEST_CODE)});
if (variant === "with-dir") css += "\\n@source " + JSON.stringify(extraDir) + ";\\n";
const result = await postcss([tailwind({ base: site })]).process(css, { from });
process.stdout.write(result.css);
`;

async function buildCss(variant: "configured" | "with-goldens" | "with-dir", extraDir = ""): Promise<string> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--input-type=module", "-e", BUILD_SCRIPT, SITE, variant, extraDir],
    { cwd: SITE, maxBuffer: 32 * 1024 * 1024 }
  );
  return stdout;
}

const tempDirs: string[] = [];
after(async () => {
  for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
});

describe("CSS coverage", () => {
  it("the comparison is sensitive: a class from an extra scanned source shows up in the CSS", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "imprint-css-probe-"));
    tempDirs.push(dir);
    await writeFile(path.join(dir, "probe.html"), '<div class="text-[#123abc]"></div>\n');
    const [plain, probed] = await Promise.all([buildCss("configured"), buildCss("with-dir", dir)]);
    assert.ok(!plain.includes("123abc"), "the probe class must not exist in the normal build");
    assert.ok(probed.includes("123abc"), "an extra scanned source must add its class to the CSS");
  });

  it("every class in the golden HTML gets CSS from the site's own sources", async () => {
    const configured = await readFile(CSS_FILE, "utf8");
    assert.ok(configured.includes(EXCLUDE_TEST), "globals.css must keep test/ out of the Tailwind scan");

    const [asConfigured, withGoldens] = await Promise.all([buildCss("configured"), buildCss("with-goldens")]);
    assert.ok(asConfigured.length > 10_000, "the CSS build produced output");
    assert.ok(
      asConfigured === withGoldens,
      "the golden HTML uses classes that no scanned source provides — is an engine package missing its @source line in globals.css?"
    );
  });
});
