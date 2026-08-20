import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [workspaceSource, episodeApiSource, stylesheetSource] = await Promise.all([
  readFile(
    new URL('../components/EpisodeStudioWorkspace.js', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../pages/api/studio/episodes/[episodeId].js', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../styles/EpisodeStudio.module.css', import.meta.url),
    'utf8'
  ),
]);

test('episode detail responses preserve the host-draft observer boundary', () => {
  assert.match(episodeApiSource, /getHostDraftViewerCapabilities/);
  assert.match(
    episodeApiSource,
    /getEpisodeStudioViewCapabilities\(\s*getHostDraftViewerCapabilities\([\s\S]*?result\.episode\.status/
  );
  assert.match(
    episodeApiSource,
    /const responseCapabilities = getHostDraftViewerCapabilities\([\s\S]*?saved\.episode\.status/
  );
  assert.match(episodeApiSource, /\.\.\.responseCapabilities/);
  assert.match(
    episodeApiSource,
    /sponsorReadResponseData\([\s\S]*?responseCapabilities\.canConfigure/
  );
});

test('producer-only draft viewers see context and discussion without production controls', () => {
  assert.match(workspaceSource, /Shared host draft · producer controls locked/);
  assert.match(workspaceSource, /Production board · locked/);
  assert.match(workspaceSource, /Waiting for host submission/);
  assert.match(
    workspaceSource,
    /\{productionView \? \(\s*hostDraftReadOnly \? \(/
  );
  assert.match(
    workspaceSource,
    /!previewData && !hostPreviewActive && !hostDraftReadOnly/
  );
  assert.match(
    workspaceSource,
    /messageComposerEnabled=\{!hostPreviewReadOnly\}/
  );
  assert.match(stylesheetSource, /\.hostDraftReadOnlyBanner/);
  assert.match(stylesheetSource, /\.hostDraftProductionLock/);
});

