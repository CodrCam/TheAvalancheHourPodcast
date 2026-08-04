import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGuestQuestionnaireSections } from '../lib/guestQuestionnaireSections.mjs';

test('guest questionnaire sections keep built-ins organized and custom prompts separate', () => {
  const questions = [
    { key: 'guest_name', built_in: true, prompt: 'Name' },
    { key: 'website', built_in: true, prompt: 'Website' },
    { key: 'close_call', built_in: true, prompt: 'Close call' },
    { key: 'shipping_city', built_in: true, prompt: 'City' },
    { key: 'custom_follow_up', built_in: false, prompt: 'Follow-up' },
  ];

  const sections = buildGuestQuestionnaireSections(questions, {
    includeEmptyAdditional: true,
    builderLabels: true,
  });

  assert.deepEqual(
    sections.map((section) => [
      section.id,
      section.questions.map((question) => question.key),
    ]),
    [
      ['about', ['guest_name']],
      ['public_links', ['website']],
      ['conversation', ['close_call']],
      ['equipment', ['shipping_city']],
      ['additional', ['custom_follow_up']],
    ]
  );
  assert.equal(sections[0].label, 'About the guest');
  assert.equal(questions.length, 5);
});

test('public sections omit empty groups and use guest-facing labels', () => {
  const sections = buildGuestQuestionnaireSections([
    { key: 'guest_bio', built_in: true },
  ]);

  assert.equal(sections.length, 1);
  assert.equal(sections[0].id, 'about');
  assert.equal(sections[0].label, 'About you');
});
