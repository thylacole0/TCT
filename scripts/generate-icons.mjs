// Generate PWA icons from SVG using sharp
// Run: node scripts/generate-icons.mjs

import { readFileSync } from 'fs';
import sharp from 'sharp';

const sizes = [192, 512];

async function generate() {
  for (const size of sizes) {
    // Regular icon
    const baseSvg = readFileSync('scripts/icon-base.svg');
    await sharp(baseSvg)
      .resize(size, size)
      .png()
      .toFile(`public/icons/icon-${size}.png`);
    console.log(`✓ icon-${size}.png`);

    // Maskable icon
    const maskSvg = readFileSync('scripts/icon-maskable.svg');
    await sharp(maskSvg)
      .resize(size, size)
      .png()
      .toFile(`public/icons/icon-maskable-${size}.png`);
    console.log(`✓ icon-maskable-${size}.png`);
  }

  // Apple touch icon (180x180)
  const baseSvg = readFileSync('scripts/icon-base.svg');
  await sharp(baseSvg)
    .resize(180, 180)
    .png()
    .toFile('public/icons/apple-touch-icon.png');
  console.log('✓ apple-touch-icon.png');
}

generate().catch(console.error);
