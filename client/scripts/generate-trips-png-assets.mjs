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

const iconSource = path.join(imagesDir, 'ComedyBlackIcon.jpeg');
const brandSource = path.join(imagesDir, 'comedy-transparent.png');
const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Keep primary artwork inside ~64% of square so iOS / adaptive-icon masks do not clip. */
const ICON_SAFE_FRACTION = 0.64;

async function main() {
  if (!fs.existsSync(iconSource) || !fs.existsSync(brandSource)) {
    console.error('Missing source images: ComedyBlackIcon.jpeg or comedy-transparent.png');
    process.exit(1);
  }

  // 1. App Icon (1024x1024)
  const iconSide = 1024;
  await sharp(iconSource)
    .resize(iconSide, iconSide, { fit: 'cover' })
    .png()
    .toFile(path.join(imagesDir, 'icon.png'));
  console.log('Wrote assets/images/icon.png');

  // 1b. Android Adaptive Icon Foreground & Background
  const adaptiveSide = 432;
  const adaptiveInner = Math.round(adaptiveSide * 0.72);
  const fgMark = await sharp(iconSource)
    .resize(adaptiveInner, adaptiveInner, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
  await sharp({
    create: { width: adaptiveSide, height: adaptiveSide, channels: 4, background: TRANSPARENT },
  })
    .composite([{ input: fgMark, gravity: 'center' }])
    .png()
    .toFile(path.join(imagesDir, 'android-icon-foreground.png'));

  await sharp({
    create: { width: adaptiveSide, height: adaptiveSide, channels: 4, background: BLACK },
  })
    .png()
    .toFile(path.join(imagesDir, 'android-icon-background.png'));
  console.log('Wrote assets/images/android-icon-foreground.png and background.png');

  // 2. Splash Screen Logo (512x512)
  await sharp(brandSource)
    .resize(512, 512, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toFile(path.join(imagesDir, 'splashscreenlogo.png'));
  console.log('Wrote assets/images/splashscreenlogo.png');

  // 3. Full screen splash.png (1242x2688) with black background
  const splashW = 1242;
  const splashH = 2688;
  const splashInner = Math.round(Math.min(splashW, splashH) * 0.40);
  const splashMark = await sharp(brandSource)
    .resize(splashInner, splashInner, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
  await sharp({
    create: { width: splashW, height: splashH, channels: 4, background: BLACK },
  })
    .composite([{ input: splashMark, gravity: 'center' }])
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));
  console.log('Wrote assets/splash.png');

  // 4. logo-trips-mark.png (In-app branding logo)
  await sharp(brandSource)
    .resize(512, 512, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toFile(path.join(imagesDir, 'logo-trips-mark.png'));
  console.log('Wrote assets/images/logo-trips-mark.png');

  // 5. Favicon (48x48)
  await sharp(iconSource)
    .resize(48, 48, { fit: 'cover' })
    .png()
    .toFile(path.join(imagesDir, 'favicon.png'));
  console.log('Wrote assets/images/favicon.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
