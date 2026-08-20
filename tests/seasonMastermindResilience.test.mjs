import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workspaceSource = await readFile(
  new URL('../components/SeasonMastermindWorkspace.js', import.meta.url),
  'utf8'
);
const clientSource = await readFile(
  new URL('../lib/seasonMastermindClient.mjs', import.meta.url),
  'utf8'
);
const templateSource = await readFile(
  new URL('../infra/aws/season-mastermind/template.yaml', import.meta.url),
  'utf8'
);

test('cold-wake timeouts preserve a bounded outer response margin', () => {
  const lambdaTimeout = Number(
    templateSource.match(/\n\s+Timeout: (\d+)\n/)?.[1]
  );
  const databaseTimeout = Number(
    templateSource.match(
      /MASTERMIND_DB_CONNECT_TIMEOUT_SECONDS: "(\d+)"/
    )?.[1]
  );
  const proxyTimeoutMs = Number(
    clientSource.match(/const DEFAULT_TIMEOUT_MS = ([\d_]+);/)?.[1].replaceAll(
      '_',
      ''
    )
  );

  assert.equal(databaseTimeout, 30);
  assert.equal(lambdaTimeout, 40);
  assert.equal(proxyTimeoutMs, 45_000);
  assert.ok(databaseTimeout < lambdaTimeout);
  assert.ok(lambdaTimeout * 1000 < proxyTimeoutMs);
});

test('Season Mastermind offers bounded user-driven retries without polling', () => {
  assert.match(workspaceSource, /const MAX_LOAD_RETRIES = 3;/);
  assert.match(
    workspaceSource,
    /const \[retryCount, setRetryCount\] = useState\(0\);/
  );
  assert.match(
    workspaceSource,
    /preview \|\| retryCount >= MAX_LOAD_RETRIES \? null : \(/
  );
  assert.match(
    workspaceSource,
    /setRetryCount\(\(current\) => current \+ 1\);/
  );
  assert.doesNotMatch(workspaceSource, /setInterval\(/);
});
