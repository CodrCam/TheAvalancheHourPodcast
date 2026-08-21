import path from 'node:path';
import sharp from 'sharp';

const ROOT = '/Users/camerongriffin/projects/TheAvalancheHour';
const ASSETS = path.join(ROOT, 'tmp/caleb-email-deck-v3/source-assets');

await sharp(path.join(ASSETS, '02-banner.png'))
  .extract({ left: 0, top: 0, width: 600, height: 360 })
  .png()
  .toFile(path.join(ASSETS, '02-testimonials-left.png'));

await sharp(path.join(ASSETS, '07-banner.png'))
  .extract({ left: 0, top: 0, width: 800, height: 360 })
  .png()
  .toFile(path.join(ASSETS, '07-audience-demographics-left.png'));
