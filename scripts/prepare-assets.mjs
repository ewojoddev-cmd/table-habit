// Derives web-ready logos from assets/Logo.png (the source of truth):
//   public/logo.png       full wordmark, trimmed, transparent background
//   public/logo-mark.png  the glyph only, trimmed, transparent background
//   public/favicon.png    square app icon from the glyph
//
// Run with: npm run art:prepare
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SOURCE = path.resolve("assets/Logo.png");
const OUT_DIR = path.resolve("public");

const image = sharp(SOURCE).ensureAlpha();
const { width, height } = await image.metadata();
const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
const channels = info.channels;

const pixel = (x, y) => {
  const i = (y * width + x) * channels;
  return [data[i], data[i + 1], data[i + 2]];
};

const distance = (a, b) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

// The logo sits on a flat, light plate; sample it from a corner.
const background = pixel(2, 2);
const LOW = 10; // fully transparent below this distance from the plate
const HIGH = 34; // fully opaque above this distance

const isInk = (x, y) => distance(pixel(x, y), background) > LOW;

function bounds(x0, x1) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (!isInk(x, y)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * The glyph sits left of the wordmark. Walk the column ink profile and stop at
 * the first wide empty column band — wider than the white lines drawn inside
 * the glyph itself, narrower than the gap before the "T".
 */
function glyphBounds() {
  const inkPerColumn = new Array(width).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isInk(x, y)) inkPerColumn[x] += 1;
    }
  }

  const firstInk = inkPerColumn.findIndex((count) => count > 0);
  const gapNeeded = Math.max(24, Math.round(width * 0.02));
  let emptyRun = 0;
  let lastX = firstInk;

  for (let x = firstInk; x < width; x += 1) {
    if (inkPerColumn[x] === 0) {
      emptyRun += 1;
      if (emptyRun >= gapNeeded) break;
    } else {
      emptyRun = 0;
      lastX = x;
    }
  }

  const box = bounds(Math.max(0, firstInk), lastX + 1);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x > box.maxX || x < box.minX) continue;
      if (!isInk(x, y)) continue;
      if (y < box.minY) box.minY = y;
      if (y > box.maxY) box.maxY = y;
    }
  }
  return box;
}

/** Crop a region and knock out the plate colour, keeping edges clean. */
function extract(box, pad = 0) {
  const minX = Math.max(0, box.minX - pad);
  const minY = Math.max(0, box.minY - pad);
  const maxX = Math.min(width - 1, box.maxX + pad);
  const maxY = Math.min(height - 1, box.maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;

  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const source = pixel(minX + x, minY + y);
      const d = distance(source, background);
      const raw = (d - LOW) / (HIGH - LOW);
      const alpha = Math.max(0, Math.min(1, raw));
      const target = (y * w + x) * 4;

      if (alpha === 0) {
        out[target + 3] = 0;
        continue;
      }
      // Un-premultiply so anti-aliased edges don't keep a pale halo.
      for (let c = 0; c < 3; c += 1) {
        const value = (source[c] - background[c] * (1 - alpha)) / alpha;
        out[target + c] = Math.max(0, Math.min(255, Math.round(value)));
      }
      out[target + 3] = Math.round(alpha * 255);
    }
  }

  return sharp(out, { raw: { width: w, height: h, channels: 4 } });
}

await mkdir(OUT_DIR, { recursive: true });

const fullBox = bounds(0, width);
const markBox = glyphBounds(); // the glyph, left of the wordmark

await extract(fullBox).png().toFile(path.join(OUT_DIR, "logo.png"));
await extract(markBox).png().toFile(path.join(OUT_DIR, "logo-mark.png"));

// Square icon: the glyph centred on the palette's light plate.
const markBuffer = await extract(markBox).png().toBuffer();
const { width: markWidth, height: markHeight } =
  await sharp(markBuffer).metadata();
const side = Math.max(markWidth, markHeight);
const plateColour = { r: 243, g: 244, b: 247, alpha: 255 };

// sharp composites after resizing, so plate first, then scale in a second pass.
const plated = await sharp({
  create: { width: side, height: side, channels: 4, background: plateColour },
})
  .composite([
    {
      input: markBuffer,
      left: Math.round((side - markWidth) / 2),
      top: Math.round((side - markHeight) / 2),
    },
  ])
  .png()
  .toBuffer();

const plate = await sharp(plated)
  .resize(256, 256, { fit: "contain", background: plateColour })
  .png()
  .toBuffer();

await writeFile(path.join(OUT_DIR, "favicon.png"), plate);

console.log("source", { width, height });
console.log("background", background);
console.log("fullBox", fullBox);
console.log("markBox", markBox, "->", { markWidth, markHeight });
