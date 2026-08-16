/**
 * Regenerates the MyLyf app icons from the lily mark.
 *
 * The paths here are the same geometry as <MyLyfMark> in
 * components/shared/logo.tsx — if you change one, change the other, or the
 * installed icon will stop matching the in-app logo.
 *
 *   node scripts/generate-icons.mjs
 *
 * Writes:
 *   app/icon.png, app/apple-icon.png     (Next.js file-convention icons)
 *   public/icons/*.png                   (PWA manifest icon set)
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Light and dark ends of the lily primary, matching app/globals.css.
const PETAL_DARK = '#9e3879';
const PETAL_LIGHT = '#d864ae';

const TEPAL = 'M12 12.6C9.1 9.9 9.1 5.6 12 2.6c2.9 3 2.9 7.3 0 10Z';
const PETAL = 'M12 12.4c-2.1-2-2.1-5.1 0-7.2 2.1 2.1 2.1 5.2 0 7.2Z';

/** The mark alone, on a 24×24 grid, in a single colour. */
function markPaths(color) {
  return `
    <g fill="${color}">
      <g opacity="0.55">
        <path d="${TEPAL}" />
        <path d="${TEPAL}" transform="rotate(120 12 12)" />
        <path d="${TEPAL}" transform="rotate(240 12 12)" />
      </g>
      <path d="${PETAL}" transform="rotate(60 12 12)" />
      <path d="${PETAL}" transform="rotate(180 12 12)" />
      <path d="${PETAL}" transform="rotate(300 12 12)" />
      <circle cx="12" cy="12" r="1.85" />
    </g>`;
}

/**
 * @param size    output edge length in px
 * @param opts.radius  corner radius as a fraction of size (0 = square)
 * @param opts.scale   mark width as a fraction of size
 */
function tileSvg(size, { radius, scale }) {
  // Centre the 24-unit mark grid inside the tile at the requested scale.
  const markSize = size * scale;
  const offset = (size - markSize) / 2;
  const unit = markSize / 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PETAL_LIGHT}" />
      <stop offset="1" stop-color="${PETAL_DARK}" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="url(#bg)" />
  <g transform="translate(${offset} ${offset}) scale(${unit})">
    ${markPaths('#ffffff')}
  </g>
</svg>`;
}

const OUTPUTS = [
  // Squircle-ish tiles for the browser tab and the manifest "any" icons.
  { file: 'app/icon.png', size: 512, radius: 0.22, scale: 0.68 },
  { file: 'public/icons/icon-192.png', size: 192, radius: 0.22, scale: 0.68 },
  { file: 'public/icons/icon-512.png', size: 512, radius: 0.22, scale: 0.68 },
  // iOS applies its own mask, so the artwork must be square and full-bleed.
  { file: 'app/apple-icon.png', size: 180, radius: 0, scale: 0.66 },
  { file: 'public/icons/apple-touch-icon.png', size: 180, radius: 0, scale: 0.66 },
  // Maskable icons get clipped to as little as the middle 80%; keep the mark
  // well inside that safe zone.
  { file: 'public/icons/maskable-192.png', size: 192, radius: 0, scale: 0.44 },
  { file: 'public/icons/maskable-512.png', size: 512, radius: 0, scale: 0.44 },
];

for (const { file, size, radius, scale } of OUTPUTS) {
  const svg = tileSvg(size, { radius, scale });
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  const target = path.join(ROOT, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, png);
  console.log(`wrote ${file} (${size}×${size})`);
}
