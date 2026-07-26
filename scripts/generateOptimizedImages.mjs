import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getOptimizedPublicImage } from '../lib/publicImage.mjs';

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, 'public');
const imageRoot = path.join(publicRoot, 'images');
const sourceRoots = {
  hosts: {
    directory: path.join(imageRoot, 'hosts'),
    resize: { width: 1200, height: 1200, fit: 'inside' },
    quality: 80,
  },
  background: {
    directory: path.join(imageRoot, 'background'),
    resize: { width: 1920, height: 1920, fit: 'inside' },
    quality: 82,
  },
  store: {
    directory: path.join(imageRoot, 'store'),
    resize: { width: 1400, height: 1400, fit: 'inside' },
    quality: 82,
  },
};
const sourceExtension = /\.(jpe?g|png|webp)$/i;

async function listImages(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listImages(absolutePath)));
    } else if (entry.isFile() && sourceExtension.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function optimizedDestination(sourcePath) {
  const publicUrl = `/${path
    .relative(publicRoot, sourcePath)
    .split(path.sep)
    .join('/')}`;
  const optimizedUrl = getOptimizedPublicImage(publicUrl).split(/[?#]/)[0];
  if (optimizedUrl === publicUrl) {
    throw new Error(`No optimized path is available for ${publicUrl}`);
  }
  return path.join(publicRoot, optimizedUrl.replace(/^\//, ''));
}

async function needsRefresh(sourcePath, destinationPath) {
  try {
    const [sourceStat, destinationStat] = await Promise.all([
      fs.stat(sourcePath),
      fs.stat(destinationPath),
    ]);
    return destinationStat.mtimeMs < sourceStat.mtimeMs;
  } catch {
    return true;
  }
}

async function optimizeImage(sourcePath, destinationPath, config) {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await sharp(sourcePath)
    .rotate()
    .resize({
      ...config.resize,
      withoutEnlargement: true,
    })
    .webp({
      quality: config.quality,
      effort: 5,
      smartSubsample: true,
    })
    .toFile(destinationPath);
}

let created = 0;
let skipped = 0;
let sourceBytes = 0;
let optimizedBytes = 0;
const claimedDestinations = new Map();

for (const config of Object.values(sourceRoots)) {
  const sourceFiles = await listImages(config.directory);

  for (const sourcePath of sourceFiles) {
    const destinationPath = optimizedDestination(sourcePath);
    const previousSource = claimedDestinations.get(destinationPath);
    if (previousSource && previousSource !== sourcePath) {
      throw new Error(
        `Optimized image collision: ${previousSource} and ${sourcePath}`
      );
    }
    claimedDestinations.set(destinationPath, sourcePath);

    if (await needsRefresh(sourcePath, destinationPath)) {
      await optimizeImage(sourcePath, destinationPath, config);
      created += 1;
    } else {
      skipped += 1;
    }

    const [sourceStat, optimizedStat] = await Promise.all([
      fs.stat(sourcePath),
      fs.stat(destinationPath),
    ]);
    sourceBytes += sourceStat.size;
    optimizedBytes += optimizedStat.size;
  }
}

const savings = sourceBytes
  ? Math.round((1 - optimizedBytes / sourceBytes) * 100)
  : 0;
console.log(
  `Optimized images ready: ${created} generated, ${skipped} current, ${savings}% smaller.`
);
