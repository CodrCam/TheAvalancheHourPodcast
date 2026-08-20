import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [component, model, route, hostStudio, overview, navigation, css] =
  await Promise.all([
    readFile(
      new URL('../components/EpisodeIdeaDesk.js', import.meta.url),
      'utf8'
    ),
    readFile(
      new URL('../components/episodeIdeaDeskModel.mjs', import.meta.url),
      'utf8'
    ),
    readFile(
      new URL('../pages/studio/episodes/ideas.js', import.meta.url),
      'utf8'
    ),
    readFile(
      new URL('../pages/studio/episodes/index.js', import.meta.url),
      'utf8'
    ),
    readFile(
      new URL('../components/StudioOverviewDashboard.js', import.meta.url),
      'utf8'
    ),
    readFile(new URL('../lib/studioNavigation.mjs', import.meta.url), 'utf8'),
    readFile(
      new URL('../styles/EpisodeIdeaDesk.module.css', import.meta.url),
      'utf8'
    ),
  ]);

test('mounts Idea Desk as a Host Studio sub-workspace without a sidebar item', () => {
  assert.match(route, /<EpisodeIdeaDesk\s*\/>/);
  assert.match(component, /aria-label="Host Studio sections"/);
  assert.match(component, /hrefFor\('\/studio\/episodes'\)/);
  assert.match(component, /hrefFor\('\/studio\/episodes\/ideas'\)/);
  assert.match(
    hostStudio,
    /href="\/studio\/episodes\/ideas">Ideas &amp; requests/
  );
  assert.match(component, />\s*Ideas &amp; requests\s*</);
  assert.match(hostStudio, /href="\/studio\/episodes\/ideas\?new=1"/);
  assert.match(hostStudio, />\s*Pitch an episode\s*</);
  assert.match(overview, /href: '\/studio\/episodes\/ideas'/);
  assert.match(overview, /Open the Idea Desk/);
  assert.doesNotMatch(navigation, /href: '\/studio\/episodes\/ideas'/);
});

test('keeps Idea Desk as the only episode-pitch creation flow', () => {
  assert.doesNotMatch(hostStudio, /buildEpisodeRequestItem/);
  assert.doesNotMatch(hostStudio, /showRequestForm/);
  assert.doesNotMatch(hostStudio, /fetch\('\/api\/studio\/intake'/);
  assert.doesNotMatch(hostStudio, /Request an episode/);
});

test('uses the scoped Idea Desk endpoint and its full mutation contract', () => {
  assert.match(component, /fetch\('\/api\/studio\/episode-ideas'/);
  assert.match(component, /method = creating \? 'POST' : 'PATCH'/);
  for (const action of [
    'create_draft',
    'submit_new',
    'save_draft',
    'submit',
    'start_review',
    'request_changes',
    'approve',
    'defer',
    'reopen',
  ]) {
    assert.match(component, new RegExp(`['"]${action}['"]`));
  }
  assert.match(model, /expected_updated_at: current\.updated_at/);
  assert.match(component, /data\.item \|\| data\.idea/);
});

test('gates edits and review controls on server-projected item capabilities', () => {
  assert.match(component, /canEpisodeIdea\(item, 'edit'\)/);
  assert.match(component, /canEpisodeIdea\(item, 'submit'\)/);
  assert.match(component, /canReview[\s\S]*canEpisodeIdea\(item, action\)/);
  assert.match(component, /\['approve', 'Approve pitch'\]/);
  assert.doesNotMatch(component, /desk\.canManage\s*\?\s*canEpisodeIdea/);
  assert.match(model, /source\[key\] === true/);
});

test('renders accessible status filters, a semantic table, and labeled mobile rows', () => {
  assert.match(component, /role="group"/);
  assert.match(component, /aria-pressed=\{selected\}/);
  assert.match(component, /<table className=\{styles\.ideaTable\}>/);
  assert.match(component, /<caption className=\{styles\.visuallyHidden\}>/);
  assert.match(component, /<th scope="row"/);
  assert.match(component, /className=\{styles\.mobileLabel\}/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /confirmUnsavedNavigation/);
  assert.doesNotMatch(component, /<main[\s>]/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /\.ideaTable thead[\s\S]*display: none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('keeps private draft copy owner-only and links approved items through the safe helper', () => {
  assert.match(model, /Only you can see and work on this pitch/);
  assert.doesNotMatch(model, /Only you and Studio managers/);
  assert.match(component, /getEpisodeIdeaFollowUpHref\(item\)/);
  assert.match(component, /Open approved follow-up/);
  assert.match(model, /item\.status !== 'approved'/);
  assert.match(model, /encodeURIComponent/);
});
