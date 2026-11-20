import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const BG = "#1c1a17";
const CREAM = "#f7f3ea";
const MUTED = "#a89f8d";
const ACCENT = "#5b9bf5";

const glyph = `
  <path fill="${CREAM}" d="M118 116h140v26h-30v204h118v-46h30v94H150v-26h30V142h-62z"/>
  <circle cx="352" cy="176" r="30" fill="${ACCENT}"/>`;

const mark = (bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}${glyph}</svg>`;
const rounded = `<rect width="512" height="512" rx="112" fill="${BG}"/>`;
const square = `<rect width="512" height="512" fill="${BG}"/>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${square}<g transform="translate(76.8 76.8) scale(.7)">${glyph}</g></svg>`;

const png = (svg, size) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png().toBuffer();

function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, buf }, i) => {
    const o = 6 + 16 * i;
    head[o] = size === 256 ? 0 : size;
    head[o + 1] = size === 256 ? 0 : size;
    head.writeUInt16LE(1, o + 4);
    head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(buf.length, o + 8);
    head.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });
  return Buffer.concat([head, ...images.map((i) => i.buf)]);
}

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <g transform="translate(810 135) scale(.7)"><rect width="512" height="512" rx="112" fill="#2a2622"/>${glyph}</g>
  <text x="90" y="350" font-family="Georgia, 'Times New Roman', serif" font-size="150" font-weight="700" fill="${CREAM}">Learn</text>
  <text x="90" y="425" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="${MUTED}">Interview questions, topic graphs and study notes.</text>
</svg>`;

await mkdir("public", { recursive: true });
const sizes = [16, 32, 48];
const icoImages = await Promise.all(sizes.map(async (size) => ({ size, buf: await png(mark(rounded), size) })));

await Promise.all([
  writeFile("app/favicon.ico", ico(icoImages)),
  png(mark(rounded), 512).then((b) => writeFile("app/icon.png", b)),
  png(mark(square), 180).then((b) => writeFile("app/apple-icon.png", b)),
  png(mark(rounded), 192).then((b) => writeFile("public/android-chrome-192x192.png", b)),
  png(mark(rounded), 512).then((b) => writeFile("public/android-chrome-512x512.png", b)),
  png(maskable, 512).then((b) => writeFile("public/maskable-512x512.png", b)),
  png(mark(rounded), 1024).then((b) => writeFile("public/logo.png", b)),
  writeFile("public/logo.svg", mark(rounded)),
  sharp(Buffer.from(og), { density: 144 }).resize(1200, 630).png().toBuffer().then(async (b) => {
    await writeFile("app/opengraph-image.png", b);
    await writeFile("app/twitter-image.png", b);
  }),
]);
console.log("icons written");
