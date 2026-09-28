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
    await page.getByRole("navigation", { name: "Folders" }).getByRole("button", { name: /fotos/ }).click();
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
