import EpisodeIdeaDesk from '../../components/EpisodeIdeaDesk';
import {
  STUDIO_PREVIEW_HREF_MAP,
  STUDIO_PREVIEW_SESSION,
} from '../../lib/studioPreviewFixtures.mjs';

const previewHrefMap = {
  ...STUDIO_PREVIEW_HREF_MAP,
  '/studio/episodes/ideas': '/dev/episode-ideas-preview',
};

const previewData = {
  ok: true,
  configured: true,
  scope: 'team',
  canManage: true,
  canReview: true,
  viewer_person_id: 'caleb-merrill',
  summary: {
    total: 6,
    drafts: 1,
    submitted: 1,
    reviewing: 1,
    needs_changes: 1,
    approved: 1,
    future: 1,
  },
  items: [
    {
      idea_id: 'preview-idea-draft',
      status: 'draft',
      working_title: 'Terrain traps after the first storm',
      premise:
        'Build a field-based episode around terrain choices when the new snow problem still feels manageable.',
      listener_takeaway:
        'Recognize when terrain consequences should outweigh confidence in the forecast.',
      research_notes: 'Compare three early-season near misses from public reports.',
      proposed_guest: 'Local forecasting team',
      preferred_air_date: '2026-10-14',
      planning_horizon: 'current_season',
      owner_name: 'Caleb Merrill',
      created_at: '2026-08-18T16:00:00.000Z',
      updated_at: '2026-08-19T15:00:00.000Z',
      capabilities: {
        can_edit: true,
        can_submit: true,
      },
    },
    {
      idea_id: 'preview-idea-submitted',
      status: 'submitted',
      working_title: 'Field decisions after rapid loading',
      premise:
        'Compare the observations that changed the decision before and after a fast-loading storm.',
      listener_takeaway:
        'Give listeners a practical pause point before committing to consequential terrain.',
      proposed_guest: 'Regional avalanche educator',
      preferred_air_date: '2026-11-04',
      planning_horizon: 'current_season',
      owner_name: 'Dom Baker',
      created_at: '2026-08-17T15:00:00.000Z',
      updated_at: '2026-08-19T14:30:00.000Z',
      capabilities: {
        can_start_review: true,
        can_request_changes: true,
        can_approve: true,
        can_defer: true,
      },
    },
    {
      idea_id: 'preview-idea-reviewing',
      status: 'reviewing',
      working_title: 'How guides communicate uncertainty',
      premise:
        'Explore the language guides use when the available evidence points in different directions.',
      listener_takeaway:
        'Use clearer uncertainty language in group decision-making.',
      proposed_guest: 'AMGA ski guide',
      planning_horizon: 'next_season',
      owner_name: 'Sara Boilen',
      created_at: '2026-08-12T15:00:00.000Z',
      updated_at: '2026-08-19T13:00:00.000Z',
      capabilities: {
        can_request_changes: true,
        can_approve: true,
        can_defer: true,
      },
    },
    {
      idea_id: 'preview-idea-needs-changes',
      status: 'needs_changes',
      working_title: 'Forecast verification from the skin track',
      premise:
        'Turn ordinary uphill observations into a repeatable forecast-verification habit.',
      listener_takeaway: '',
      proposed_guest: '',
      planning_horizon: 'current_season',
      decision_note:
        'Add the specific listener decision this episode should improve before resubmitting.',
      owner_name: 'Caleb Merrill',
      created_at: '2026-08-10T15:00:00.000Z',
      updated_at: '2026-08-19T12:00:00.000Z',
      capabilities: {
        can_edit: true,
        can_submit: true,
        can_defer: true,
      },
    },
    {
      idea_id: 'preview-idea-approved',
      status: 'approved',
      working_title: 'Reading the first storm of the season',
      premise:
        'Use the season opener to reset observation habits after the summer break.',
      listener_takeaway:
        'Start the winter with a disciplined observation and communication routine.',
      proposed_guest: 'Avalanche forecaster panel',
      preferred_air_date: '2026-10-07',
      planning_horizon: 'current_season',
      decision_note: 'Approved for the Season 11 opening run.',
      owner_name: 'Morgan Dinsdale',
      source_intake_item_id: 'preview-approved-follow-up',
      created_at: '2026-08-04T15:00:00.000Z',
      updated_at: '2026-08-18T18:00:00.000Z',
      capabilities: {},
    },
    {
      idea_id: 'preview-idea-future',
      status: 'future',
      working_title: 'A history of community avalanche centers',
      premise:
        'Trace how regional centers changed the way local observations become public safety information.',
      listener_takeaway:
        'Understand how community reporting supports the daily forecast.',
      planning_horizon: 'future',
      decision_note: 'Hold for a summer history series or Season 12.',
      owner_name: 'Angie Lake',
      created_at: '2026-08-02T15:00:00.000Z',
      updated_at: '2026-08-18T16:00:00.000Z',
      capabilities: { can_reopen: true },
    },
  ],
};

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') return { notFound: true };
  return { props: {} };
}

export default function EpisodeIdeasPreviewPage() {
  return (
    <EpisodeIdeaDesk
      previewData={previewData}
      previewSession={STUDIO_PREVIEW_SESSION}
      previewPath="/studio/episodes/ideas"
      previewHrefMap={previewHrefMap}
    />
  );
}
