import exifr from "exifr";
import sharp from "sharp";

import { authFile } from "./env";
import { expect, test } from "./test";

test.use({ storageState: authFile("editor") });

/**
 * The media library (design/beeldbibliotheek.md, step 1): upload a camera
 * photo, see its EXIF read, file it in a folder, and prove access per format
 * over HTTP — a visitor gets the small public versions, never the original or
 * the sizes above "public up to"; the editor gets everything. The photo is
 * made here: 3000 px with camera data and a GPS position.
 */
test.describe.configure({ mode: "serial" });

const ANON = { storageState: { cookies: [], origins: [] } };
let formats: { w400: string; w1600: string; original: string };

async function cameraPhoto(): Promise<Buffer> {
  return sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#2a6f97" } })
    .withExif({
      IFD0: { Make: "Leica", Model: "Q2", Artist: "E2E Fotograaf" },
      IFD2: { ExposureTime: "1/250", FNumber: "28/10", ISOSpeedRatings: "100", FocalLength: "28/1", LensModel: "Summilux 28" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "52/1 5/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "5/1 7/1 0/1" },
    })
    .jpeg()
    .toBuffer();
}

test.describe("media library", () => {
  test("upload a photo: variants made, camera data read, location dropped by default", async ({ page }) => {
    await page.goto("/admin/asset");
    await expect(page.getByRole("heading", { name: /^Media/ })).toBeVisible();
    await page.getByTestId("media-upload").setInputFiles({ name: "e2e-strand.jpg", mimeType: "image/jpeg", buffer: await cameraPhoto() });

    // The new photo is selected: its details show what EXIF said.
    await expect(page.getByText("e2e-strand.jpg · 3000×2000")).toBeVisible();
    await expect(page.getByText("Leica Q2 · Summilux 28 · 28 mm · f/2.8 · 1/250 · ISO 100")).toBeVisible();
    await expect(page.getByLabel("Credit")).toHaveValue("E2E Fotograaf");
    await expect(page.getByText(/📍/)).toHaveCount(0);
    await expect(page.getByText("400×267 WebP")).toBeVisible();
    await expect(page.getByText("2400×1600 WebP")).toBeVisible();
  });

  test("describe it, file it in a folder, and cap the public size", async ({ page }) => {
    await page.goto("/admin/asset");
    await page.getByRole("button", { name: /e2e strand/ }).click();
    await page.getByLabel("Alt text").fill("Een strand bij laag water");
    await page.getByLabel("Folder", { exact: true }).fill("e2e/fotos");
    await page.getByLabel("Public up to").selectOption("800");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved ✓")).toBeVisible();

    // The folder tree has the new folders; opening one shows the photo.
    await page.getByRole("navigation", { name: "Folders" }).getByRole("button", { name: /^Folder e2e\/fotos,/ }).click();
    await expect(page.getByRole("button", { name: /e2e strand/ })).toBeVisible();
    await page.getByRole("button", { name: /e2e strand/ }).click();
    await expect(page.getByText("editors only")).toHaveCount(3); // 1600, 2400 and the original

    const href = async (name: string | RegExp) => (await page.getByRole("link", { name }).getAttribute("href"))!;
    formats = { w400: await href("400×267 WebP"), w1600: await href("1600×1067 WebP"), original: await href(/^original/) };
  });

  test("a visitor gets the small public versions only — without the location", async ({ browser }) => {
    const visitor = await browser.newContext(ANON);
    const small = await visitor.request.get(formats.w400);
    expect(small.status()).toBe(200);
    expect(small.headers()["cache-control"]).toContain("immutable");
    const meta = await sharp(await small.body()).metadata();
    expect(meta.format).toBe("webp");
    const tiff = meta.exif!.subarray(6);
    const exif = await exifr.parse(tiff, { gps: true });
    expect(exif.Make).toBe("Leica");
    expect(exif.latitude).toBeUndefined();

    expect((await visitor.request.get(formats.w1600)).status()).toBe(403);
    expect((await visitor.request.get(formats.original)).status()).toBe(403);
    await visitor.close();
  });

  test("the editor gets the original, untouched (location included)", async ({ page }) => {
    const res = await page.request.get(formats.original);
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("private");
    const exif = await exifr.parse(await res.body(), { gps: true });
    expect(Math.abs(exif.latitude - 52.0833)).toBeLessThan(0.001);
  });

  test("tag lists: make one, add a tag, tag the photo, filter on it", async ({ page }) => {
    await page.goto("/admin/asset");
    await page.getByRole("button", { name: "＋ Tag list" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("E2E Onderwerp");
    await page.getByRole("dialog").getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("E2E Onderwerp", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add a tag to E2E Onderwerp" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("Strand");
    await page.getByRole("dialog").getByRole("button", { name: "Add" }).click();
    const chip = page.getByRole("region", { name: "Tags" }).getByRole("button", { name: "Strand", exact: true });
    await expect(chip).toBeVisible();

    await page.getByRole("button", { name: /e2e strand/ }).click();
    await page.getByLabel("Add from E2E Onderwerp").selectOption({ label: "Strand" });
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved ✓")).toBeVisible();

    // Filtering on the tag keeps the photo; a tag nobody has would empty the grid.
    await chip.click();
    await expect(page.getByRole("button", { name: /e2e strand/ })).toBeVisible();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await chip.click(); // filter off again

    // A typo is fixed in the list; the tagged photo follows.
    await page.getByRole("button", { name: "Edit E2E Onderwerp" }).click();
    await page.getByRole("button", { name: "Rename tag Strand" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill("Strand en zee");
    await page.getByRole("dialog").getByRole("button", { name: "Rename" }).click();
    await expect(page.getByRole("status")).toContainText("Tag renamed; 1 file updated.");
    await page.getByRole("button", { name: "Done editing E2E Onderwerp" }).click();
    await page.getByRole("button", { name: /e2e strand/ }).click();
    await expect(page.getByLabel("Tags of this file")).toContainText("Strand en zee");
  });

  test("a recording as one group: wav + mid + patch → one card; audio seeks by Range", async ({ page, browser }) => {
    const wav = Buffer.alloc(44 + 48000 * 6);
    wav.write("RIFF", 0, "latin1");
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVEfmt ", 8, "latin1");
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(2, 22);
    wav.writeUInt32LE(48000, 24);
    wav.writeUInt32LE(48000 * 6, 28);
    wav.writeUInt16LE(6, 32);
    wav.writeUInt16LE(24, 34);
    wav.write("data", 36, "latin1");
    wav.writeUInt32LE(48000 * 6, 40);
    const mid = Buffer.from("4d546864000000060001000301e0", "hex");
    const json = Buffer.from(JSON.stringify({ type: "mmb-patch", modules: [] }));

    await page.goto("/admin/asset");
    await page.getByLabel("as one group").check();
    await page.getByTestId("media-upload").setInputFiles([
      { name: "e2e-take.wav", mimeType: "audio/wav", buffer: wav },
      { name: "e2e-take.mid", mimeType: "audio/midi", buffer: mid },
      { name: "e2e-take.patch.json", mimeType: "application/json", buffer: json },
    ]);
    const card = page.getByRole("button", { name: /e2e-take-[a-z0-9]+$/ });
    await expect(card).toBeVisible();
    await expect(card).toContainText("3 files");
    await expect(page.getByText("0:01 · 48 kHz · 24-bit · stereo")).toBeVisible();
    await page.getByRole("button", { name: "e2e-take.mid" }).click();
    await expect(page.getByText("MIDI · format 1 · 3 tracks · 480 ppq")).toBeVisible();

    // A visitor's player asks for byte ranges.
    const src = (await page.getByRole("link", { name: /^Download \(audio\/midi\)/ }).getAttribute("href"))!;
    await page.getByRole("button", { name: "e2e-take.wav" }).click();
    const wavUrl = (await page.getByRole("link", { name: /^Download \(audio\/wav\)/ }).getAttribute("href"))!;
    const visitor = await browser.newContext(ANON);
    const ranged = await visitor.request.get(wavUrl, { headers: { Range: "bytes=0-43" } });
    expect(ranged.status()).toBe(206);
    expect(ranged.headers()["content-range"]).toBe(`bytes 0-43/${wav.length}`);
    expect((await visitor.request.get(src)).status()).toBe(200);
    await visitor.close();

    // Moving one file moves the group; deleting the group removes the card.
    await page.getByLabel("Folder", { exact: true }).fill("e2e/opnames");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved ✓")).toBeVisible();
    await page.getByRole("navigation", { name: "Folders" }).getByRole("button", { name: /^Folder e2e\/opnames,/ }).click();
    await expect(card).toContainText("3 files");
    await page.getByRole("button", { name: "Delete group" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(card).toHaveCount(0);
  });

  test("pick it in a widget: the page shows the public size with the library's alt; the library knows where it is used", async ({ page }) => {
    await page.goto("/admin/page/edit");
    await page.getByLabel("slug", { exact: true }).fill("e2e-picked");
    await page.getByLabel("title", { exact: true }).fill("E2E Picked");
    await page.waitForTimeout(600);
    await expect(page.getByText("syncing…")).toHaveCount(0);
    await page.getByRole("button", { name: "＋ Add row" }).click();
    await page.getByRole("button", { name: "＋ Add widget" }).click();
    await page.getByRole("button", { name: "Image", exact: true }).click();
    // The new widget's editor is in the sidebar (not the page settings, which have an image field too).
    await expect(page.getByRole("heading", { name: /^Image/ })).toBeVisible();

    await page.getByRole("button", { name: "Choose from library" }).click();
    const picker = page.getByRole("dialog", { name: "Choose from the media library" });
    await picker.getByRole("button", { name: /e2e strand/ }).click();
    await expect(picker).toHaveCount(0);
    await expect(page.getByRole("group", { name: "src" })).toContainText("e2e strand");
    await page.waitForTimeout(600);
    await expect(page.getByText("syncing…")).toHaveCount(0);
    await page.getByRole("button", { name: "Create page" }).click();
    await expect(page).toHaveURL(/\/admin\/page\/edit\/e2e-picked/);

    const res = await page.goto("/e2e-picked");
    expect(res?.status()).toBe(200);
    const img = page.getByRole("img", { name: "Een strand bij laag water" });
    await expect(img).toHaveAttribute("src", /\/library\/e2e-strand\/w800\./);

    await page.goto("/admin/asset");
    await page.getByRole("button", { name: /e2e strand/ }).click();
    await expect(page.getByRole("list", { name: "Used in" })).toContainText("E2E Picked");
  });

  test("delete: gone from the library, kept in History", async ({ page }) => {
    await page.goto("/admin/asset");
    await page.getByRole("button", { name: /e2e strand/ }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click(); // the confirm dialog
    await expect(page.getByRole("button", { name: /e2e strand/ })).toHaveCount(0);
    await page.goto("/admin/asset/history/e2e-strand");
    await expect(page.locator("article").first()).toBeVisible();
  });
});
