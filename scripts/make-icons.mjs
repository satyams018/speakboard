// Draws the PNG app icons (same design as src/icons/icon.svg) without any image
// library: pixels are computed directly and encoded as PNG with zlib.
// Run: node scripts/make-icons.mjs
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BLUE = hex("#1f5f8b");
const WHITE = [255, 255, 255];
const ORANGE = hex("#f4a340");
const GREEN = hex("#5cb85c");
const YELLOW = hex("#f2c94c");

// Is (x, y) inside a rounded rectangle? Coordinates are in the 512-unit design space.
function inRoundRect(x, y, rx, ry, w, h, r) {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// Is (x, y) inside the speech-bubble tail triangle (160,344)-(236,344)-(160,404)?
function inTail(x, y) {
  if (y < 340 || y > 404 || x < 160) return false;
  return x <= 236 - ((y - 344) * 76) / 60;
}

function colourAt(x, y) {
  if (inRoundRect(x, y, 150, 190, 56, 56, 12)) return ORANGE;
  if (inRoundRect(x, y, 228, 190, 56, 56, 12)) return GREEN;
  if (inRoundRect(x, y, 306, 190, 56, 56, 12)) return YELLOW;
  if (inRoundRect(x, y, 88, 136, 336, 208, 40) || inTail(x, y)) return WHITE;
  if (inRoundRect(x, y, 0, 0, 512, 512, 112)) return BLUE;
  return null;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const samples = 3; // 3x3 supersampling for smooth edges
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = ((px + (sx + 0.5) / samples) / size) * 512;
          const y = ((py + (sy + 0.5) / samples) / size) * 512;
          const c = colourAt(x, y);
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 255;
          }
        }
      }
      const n = samples * samples;
      const covered = a / 255 || 1;
      const o = py * (size * 4 + 1) + 1 + px * 4;
      raw[o] = Math.round(r / covered);
      raw[o + 1] = Math.round(g / covered);
      raw[o + 2] = Math.round(b / covered);
      raw[o + 3] = Math.round(a / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(new URL(`../src/icons/icon-${size}.png`, import.meta.url), png(size));
  console.log(`wrote src/icons/icon-${size}.png`);
}
