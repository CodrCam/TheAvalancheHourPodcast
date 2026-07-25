import { runStudioReminderGeneration } from '../lib/studioReminderService.js';

try {
  const result = await runStudioReminderGeneration();
  process.stdout.write(
    `Reminder run complete: ${result.created} created, ${result.duplicates} duplicates skipped.\n`
  );
} catch {
  process.stderr.write('Reminder run failed.\n');
  process.exitCode = 1;
}
