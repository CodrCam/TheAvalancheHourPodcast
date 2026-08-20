import {
  invokeSeasonMastermind,
  SeasonMastermindServiceError,
} from '../lib/seasonMastermindClient.mjs';

const mode = process.argv[2] || 'overview';

if (mode === 'overview') {
  const result = await invokeSeasonMastermind({
    operation: 'get_season_overview',
    actor: { person_id: 'deployment-smoke', can_manage: true },
    input: {},
  });

  console.log(
    JSON.stringify({
      signedRead: result?.ok === true,
      season: result?.season?.label || null,
      planningTotal: result?.planning?.total ?? null,
      byType: result?.planning?.by_type || null,
      byStatus: result?.planning?.by_status || null,
    })
  );
} else if (mode === 'write-lock') {
  try {
    await invokeSeasonMastermind({
      operation: 'create_season',
      actor: { person_id: 'deployment-smoke', can_manage: true },
      input: {
        label: 'Deployment write-lock check',
        starts_on: '2026-08-19',
        ends_on: '2026-08-20',
      },
    });
    throw new Error('Mutation unexpectedly succeeded while writes were disabled.');
  } catch (error) {
    if (
      error instanceof SeasonMastermindServiceError &&
      error.code === 'writes_disabled'
    ) {
      console.log(JSON.stringify({ writeLock: true, code: error.code }));
    } else {
      throw error;
    }
  }
} else {
  throw new Error(`Unknown smoke mode: ${mode}`);
}
