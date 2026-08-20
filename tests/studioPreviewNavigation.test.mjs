import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleStudioNavigationItems } from '../lib/studioNavigation.mjs';
import {
  STUDIO_PREVIEW_HREF_MAP,
  STUDIO_PREVIEW_SESSION,
} from '../lib/studioPreviewFixtures.mjs';

test('maps every visible local-preview navigation item to another preview', () => {
  const items = getVisibleStudioNavigationItems(
    STUDIO_PREVIEW_SESSION.permissions,
    STUDIO_PREVIEW_SESSION.features,
    STUDIO_PREVIEW_SESSION.capabilities
  );

  assert.ok(items.length > 0);
  for (const item of items) {
    assert.match(
      STUDIO_PREVIEW_HREF_MAP[item.href] || '',
      /^\/dev\//,
      `${item.label} must stay inside the local preview flow`
    );
  }
  assert.match(STUDIO_PREVIEW_HREF_MAP['/studio/notifications'], /^\/dev\//);
});
