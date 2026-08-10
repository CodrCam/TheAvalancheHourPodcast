import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import dotenv from 'dotenv';
import {
  createStudioResourceVideoUpload,
  verifyStudioResourceVideoObject,
  verifyStudioResourceVideoUploadToken,
} from '../lib/studioResourceVideoStorage.js';
import { validateStudioResourceVideoFile } from '../lib/studioResourceVideoPolicy.mjs';
import {
  getStudioGuide,
  publishStudioGuide,
} from '../lib/studioGuideStore.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });

function argument(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? String(process.argv[index + 1] || '') : fallback;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/publishStudioResourceVideo.mjs --file /path/video.mp4',
    '    [--section manual-orientation] [--title "Host Walkthrough"]',
    '    [--description "..."] --publish',
  ].join('\n');
}

function uploadToS3(filePath, upload) {
  return new Promise((resolve, reject) => {
    const total = fs.statSync(filePath).size;
    let transferred = 0;
    let lastReportedPercent = -1;
    const request = https.request(
      new URL(upload.upload_url),
      {
        method: upload.upload_method || 'PUT',
        headers: {
          ...(upload.upload_headers || {}),
          'Content-Length': total,
        },
      },
      (response) => {
        const responseChunks = [];
        response.on('data', (chunk) => {
          if (
            responseChunks.reduce((total, item) => total + item.length, 0) <
            16 * 1024
          ) {
            responseChunks.push(chunk);
          }
        });
        response.on('end', () => {
          const status = Number(response.statusCode) || 0;
          if (status >= 200 && status < 300) resolve();
          else {
            const detail = Buffer.concat(responseChunks)
              .toString('utf8')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 1200);
            reject(
              new Error(
                `S3 rejected the upload with HTTP ${status}${
                  detail ? `: ${detail}` : '.'
                }`
              )
            );
          }
        });
      }
    );
    request.on('error', reject);
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => {
      transferred += chunk.length;
      const percent = Math.floor((transferred / total) * 100);
      if (percent >= lastReportedPercent + 5 || percent === 100) {
        lastReportedPercent = percent;
        process.stderr.write(`Upload ${percent}%\n`);
      }
    });
    stream.pipe(request);
  });
}

const filePath = path.resolve(argument('file'));
const sectionId = argument('section', 'manual-orientation');
const title = argument('title', 'Host Walkthrough').trim().slice(0, 180);
const description = argument(
  'description',
  'A complete walkthrough of the host workflow and Resource Center.'
)
  .trim()
  .slice(0, 800);
const shouldPublish = process.argv.includes('--publish');

if (!argument('file') || !fs.existsSync(filePath)) {
  throw new Error(`Choose an existing MP4 file.\n${usage()}`);
}
if (!shouldPublish) {
  throw new Error(`Add --publish to confirm the backend write.\n${usage()}`);
}

const stat = fs.statSync(filePath);
const file = validateStudioResourceVideoFile({
  file_name: path.basename(filePath),
  content_type: 'video/mp4',
  size: stat.size,
});
const current = await getStudioGuide({ forHosts: false, includeDraft: true });
const targetSection = current.guide.sections.find(
  (section) => section.id === sectionId
);
if (!targetSection) {
  throw new Error(`The Resource Center section "${sectionId}" does not exist.`);
}
const duplicate = current.guide.sections
  .flatMap((section) => section.videos || [])
  .find((video) => video.file_name === file.file_name);
if (duplicate) {
  process.stdout.write(
    `${JSON.stringify({ ok: true, skipped: true, video: duplicate }, null, 2)}\n`
  );
  process.exit(0);
}

const upload = createStudioResourceVideoUpload({
  uploaderId: 'codex-resource-video-import',
  file,
});
await uploadToS3(filePath, upload);
const payload = verifyStudioResourceVideoUploadToken(upload.upload_token);
const verified = await verifyStudioResourceVideoObject(payload);
const video = {
  id: payload.video_id,
  title,
  description,
  file_name: payload.file_name,
  object_key: payload.object_key,
  object_version_id: verified.object_version_id,
  content_type: verified.content_type,
  size: verified.size,
  active: true,
  featured: true,
};
const guide = {
  ...current.guide,
  sections: current.guide.sections.map((section) =>
    section.id === sectionId
      ? { ...section, videos: [...(section.videos || []), video] }
      : section
  ),
};

try {
  const published = await publishStudioGuide(guide, {
    expectedUpdatedAt: current.updated_at || '',
    expectedDraftUpdatedAt: current.draft_updated_at || '',
    updatedBy: 'codex-resource-video-import',
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        section_id: sectionId,
        video,
        published_at: published.updated_at,
      },
      null,
      2
    )}\n`
  );
} catch (error) {
  process.stderr.write(
    `The video reached S3 but the guide publish failed. Preserve this recovery metadata:\n${JSON.stringify(
      video,
      null,
      2
    )}\n`
  );
  throw error;
}
