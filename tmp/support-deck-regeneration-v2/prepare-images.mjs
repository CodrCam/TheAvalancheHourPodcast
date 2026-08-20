import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = '/Users/camerongriffin/projects/TheAvalancheHour';
const DRIVE = path.join(ROOT, 'tmp/support-deck-regeneration-v2/drive-assets');
const SOURCE_DECK_MEDIA = path.join(ROOT, 'tmp/support-deck-regeneration-v2/source-media');
const OUT = path.join(ROOT, 'tmp/support-deck-regeneration-v2/prepared-assets');

await fs.mkdir(OUT, { recursive: true });

const jobs = [
  {
    source: path.join(ROOT, 'public/images/background/main-page3.jpg'),
    output: 'cover-1280x720.jpg',
    width: 2560,
    height: 1440,
    position: 'centre',
  },
  {
    source: path.join(DRIVE, 'maybird-path.jpg'),
    output: 'audience-480x720.jpg',
    width: 1200,
    height: 1800,
    position: 'centre',
  },
  {
    source: path.join(DRIVE, 'drive-img-1204-probe-fieldwork.jpg'),
    output: 'profile-430x720.jpg',
    width: 1075,
    height: 1800,
    position: 'east',
  },
  {
    source: path.join(DRIVE, 'wet-slab-debris.jpg'),
    output: 'momentum-1280x720.jpg',
    width: 2560,
    height: 1440,
    position: 'centre',
  },
  {
    source: path.join(SOURCE_DECK_MEDIA, 'image2.jpeg'),
    output: 'cadence-1280x720.jpg',
    width: 2560,
    height: 1440,
    position: 'centre',
  },
  {
    source: path.join(DRIVE, 'sean-snowbird.jpg'),
    output: 'value-1280x720.jpg',
    width: 2560,
    height: 1440,
    position: 'centre',
  },
  {
    source: path.join(SOURCE_DECK_MEDIA, 'image10.jpeg'),
    output: 'close-1280x720.jpg',
    width: 2560,
    height: 1440,
    position: 'north',
  },
];

for (const job of jobs) {
  await sharp(job.source)
    .rotate()
    .resize({ width: job.width, height: job.height, fit: 'cover', position: job.position })
    .jpeg({ quality: 91, chromaSubsampling: '4:4:4', mozjpeg: true })
    .withMetadata({ orientation: 1 })
    .toFile(path.join(OUT, job.output));
}

console.log(OUT);
