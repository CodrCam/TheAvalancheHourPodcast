// Creates the dedicated mic-kit library table and seeds the provisional
// inventory. It is a dry run unless --apply is provided.
require('dotenv').config({ path: '.env.local' });

const TABLE_NAME =
  String(process.env.DYNAMODB_MIC_KITS_TABLE || '').trim() ||
  'AvalancheHourMicKits';

function isMissingTable(error) {
  return /resource.*not found|cannot do operations on a non-existent table/i.test(
    String(error?.message || '')
  );
}

async function waitForActive(dynamoDbRequest) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await dynamoDbRequest('DescribeTable', {
      TableName: TABLE_NAME,
    });
    if (result.Table?.TableStatus === 'ACTIVE') return result.Table;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Timed out while waiting for the mic-kit table.');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const [{ dynamoDbRequest }, presentation] = await Promise.all([
    import('../lib/dynamoDb.js'),
    import('../lib/micKitPresentation.mjs'),
  ]);

  console.log(`Mic-kit table: ${TABLE_NAME}`);
  console.log('Partition key: tracker_id (String)');
  console.log('Capacity: on-demand');

  if (!apply) {
    console.log('Dry run only. Re-run with -- --apply to create and seed it.');
    return;
  }

  let tableExists = true;
  try {
    await dynamoDbRequest('DescribeTable', { TableName: TABLE_NAME });
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    tableExists = false;
  }

  if (!tableExists) {
    await dynamoDbRequest('CreateTable', {
      TableName: TABLE_NAME,
      AttributeDefinitions: [
        { AttributeName: 'tracker_id', AttributeType: 'S' },
      ],
      KeySchema: [{ AttributeName: 'tracker_id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
      Tags: [
        { Key: 'Application', Value: 'TheAvalancheHour' },
        { Key: 'Purpose', Value: 'MicKitLibrary' },
      ],
    });
    await waitForActive(dynamoDbRequest);
    console.log('Created the dedicated mic-kit table.');
  } else {
    console.log('The dedicated mic-kit table already exists.');
  }

  const now = new Date().toISOString();
  const tracker = presentation.normalizeMicKitTracker({
    ...presentation.DEFAULT_MIC_KIT_TRACKER,
    updated_at: now,
    updated_by: 'initial setup',
  });

  try {
    await dynamoDbRequest('PutItem', {
      TableName: TABLE_NAME,
      Item: {
        tracker_id: { S: presentation.MIC_KIT_TRACKER_KEY },
        content_json: { S: JSON.stringify(tracker) },
        updated_at: { S: now },
        updated_by: { S: tracker.updated_by },
      },
      ConditionExpression: 'attribute_not_exists(#tracker_id)',
      ExpressionAttributeNames: { '#tracker_id': 'tracker_id' },
    });
    console.log('Seeded the provisional four-plus-one inventory.');
  } catch (error) {
    if (!/conditional/i.test(String(error.message || ''))) throw error;
    console.log('Preserved the existing mic-kit library data.');
  }
}

main().catch((error) => {
  console.error('Mic-kit table setup failed:', error.message);
  process.exitCode = 1;
});
