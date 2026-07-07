/**
 * Rasterize Giggle image for Expo (icon, favicon, marks, splash).
 * Full-screen `assets/splash.png` and logo marks are built from `giggle.png`.
 * Run: npm run assets:trips-png
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.join(__dirname, '..');
const imagesDir = path.join(clientRoot, 'assets', 'images');
const assetsDir = path.join(clientRoot, 'assets');

const sourceImage = path.join(imagesDir, 'giggle.png');
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** Keep primary artwork inside ~64% of square so iOS / adaptive-icon masks do not clip. */
const ICON_SAFE_FRACTION = 0.64;

async function main() {
  if (!fs.existsSync(sourceImage)) {
    console.error('Missing source image:', sourceImage);
    process.exit(1);
  }

  // 1. App Icon (1024x1024)
  const iconSide = 1024;
  const iconInner = Math.round(iconSide * ICON_SAFE_FRACTION);
  const iconMark = await sharp(sourceImage)
    .resize(iconInner, iconInner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: iconSide, height: iconSide, channels: 4, background: WHITE },
  })
    .composite([{ input: iconMark, gravity: 'center' }])
    .png()
    .toFile(path.join(imagesDir, 'icon.png'));
  console.log('Wrote assets/images/icon.png');

  // 2. Splash Screen Logo (512x512)
  await sharp(sourceImage)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(imagesDir, 'splashscreenlogo.png'));
  console.log('Wrote assets/images/splashscreenlogo.png');

  // 3. Full screen splash.png (1242x2688) with white background
  const splashW = 1242;
  const splashH = 2688;
  const splashInner = Math.round(Math.min(splashW, splashH) * 0.34);
  const splashMark = await sharp(sourceImage)
    .resize(splashInner, splashInner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: splashW, height: splashH, channels: 4, background: WHITE },
  })
    .composite([{ input: splashMark, gravity: 'center' }])
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));
  console.log('Wrote assets/splash.png');

  // 4. logo-trips-mark.png (In-app branding logo)
  await sharp(sourceImage)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(imagesDir, 'logo-trips-mark.png'));
  console.log('Wrote assets/images/logo-trips-mark.png');

  // 5. Favicon (48x48)
  const favSide = 48;
  const favInner = Math.round(favSide * ICON_SAFE_FRACTION);
  const favMark = await sharp(sourceImage)
    .resize(favInner, favInner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: favSide, height: favSide, channels: 4, background: WHITE },
  })
    .composite([{ input: favMark, gravity: 'center' }])
    .png()
    .toFile(path.join(imagesDir, 'favicon.png'));
  console.log('Wrote assets/images/favicon.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
