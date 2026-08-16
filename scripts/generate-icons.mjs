/**
 * Generates the PWA icon set from a single inline SVG source.
 *
 * Run with:  node scripts/generate-icons.mjs
 *
 * Uses `sharp`, which is already present as a Next.js dependency, so this adds
 * nothing to the install. Re-run it after changing the artwork below.
 *
 * Output (public/icons/):
 *   icon-192.png, icon-512.png            -- purpose "any"
 *   maskable-192.png, maskable-512.png    -- purpose "maskable", with the 20%
 *                                            safe-zone padding Android needs so
 *                                            the icon is not clipped by the
 *                                            launcher's mask
 *   apple-touch-icon.png                  -- 180x180 for iOS home screen
 *   favicon.ico is not generated; app/icon.png serves that role in Next.js
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.join(process.cwd(), 'public', 'icons');

const BRAND = '#1b7a55';
const BRAND_LIGHT = '#34b183';

/**
 * A leaf/plate mark on a rounded brand-coloured tile.
 * `inset` is the fraction of the canvas kept clear around the glyph — maskable
 * icons need a wide margin, plain icons do not.
 */
function iconSvg({ size, inset, rounded }) {
  const radius = rounded ? size * 0.22 : 0;
  const glyph = size * (1 - inset * 2);
  const offset = size * inset;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND_LIGHT}"/>
      <stop offset="100%" stop-color="${BRAND}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset}) scale(${glyph / 100})">
    <!-- Leaf blade: tip at the top right, rounded base at the bottom left. -->
    <path d="M86 14 C86 52 62 86 26 88 C14 68 18 40 40 26 C54 17 70 13 86 14 Z"
          fill="#ffffff"/>
    <!-- Midrib, running base to tip and staying inside the blade. -->
    <path d="M28 84 C44 62 62 40 82 19" stroke="${BRAND}" stroke-width="6"
          stroke-linecap="round" fill="none"/>
    <!-- One side vein. More than this turns to mush at 48px. -->
    <path d="M43 63 C54 60 62 52 67 42" stroke="${BRAND}" stroke-width="4"
          stroke-linecap="round" fill="none" opacity="0.6"/>
  </g>
</svg>`;
}

async function render(name, { size, inset, rounded }) {
  const svg = iconSvg({ size, inset, rounded });
  const buffer = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(path.join(OUT_DIR, name), buffer);
  console.log(`  ${name}  (${size}x${size}, ${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log('Generating icons into public/icons/');

  // Standard icons: rounded tile, modest padding.
  await render('icon-192.png', { size: 192, inset: 0.18, rounded: true });
  await render('icon-512.png', { size: 512, inset: 0.18, rounded: true });

  // Maskable: full-bleed square, glyph inside the 20% safe zone.
  await render('maskable-192.png', { size: 192, inset: 0.28, rounded: false });
  await render('maskable-512.png', { size: 512, inset: 0.28, rounded: false });

  // iOS home screen. iOS applies its own mask, so no rounding here.
  await render('apple-touch-icon.png', { size: 180, inset: 0.16, rounded: false });

  console.log('Done.');
}

main().catch((error) => {
  console.error('Icon generation failed:', error);
  process.exit(1);
});
