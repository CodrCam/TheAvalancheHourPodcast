// Creates the dedicated product catalog table and seeds the current static
// catalog. It is a dry run unless --apply is provided. Existing products are
// preserved unless --overwrite is explicitly supplied.
require('dotenv').config({ path: '.env.local' });

const TABLE_NAME =
  String(process.env.DYNAMODB_PRODUCTS_TABLE || '').trim() ||
  'AvalancheHourProducts';

process.env.DYNAMODB_PRODUCTS_TABLE = TABLE_NAME;

function isMissingTable(error) {
  return /resource.*not found|cannot do operations on a non-existent table/i.test(
    String(error?.message || '')
  );
}

function isAccessDenied(error) {
  return /accessdenied|not authorized to perform|no identity-based policy allows/i.test(
    String(error?.message || '')
  );
}

function formatSetupError(error) {
  const message = String(error?.message || error || 'Unknown setup error');
  if (!isAccessDenied(error)) return message;

  if (
    /dynamodb:(?:PutItem|UpdateItem|DeleteItem|GetItem|Query|TransactWriteItems)/i.test(
      message
    )
  ) {
    return [
      message,
      '',
      'Seed-only mode reached the catalog write, but the configured website identity does not yet have catalog data access.',
      `Grant it the documented read/write actions on arn:aws:dynamodb:us-east-2:426018612622:table/${TABLE_NAME} and read access to that table's catalog-index.`,
      'This does not require DescribeTable or CreateTable permission.',
      'After updating the IAM policy, retry:',
      '  npm run create:dynamo-products -- --apply --seed-only',
    ].join('\n');
  }

  return [
    message,
    '',
    'The configured DynamoDB identity does not have infrastructure permission for this setup step.',
    'Keep the production site identity limited to data access; do not grant it CreateTable.',
    `Create ${TABLE_NAME} with an AWS administrator/infrastructure identity, then grant the site identity data access to the table and its catalog-index.`,
    'After the table and IAM policy exist, seed it with:',
    '  npm run create:dynamo-products -- --apply --seed-only',
  ].join('\n');
}

async function waitForActive(dynamoDbRequest) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await dynamoDbRequest('DescribeTable', {
      TableName: TABLE_NAME,
    });
    if (result.Table?.TableStatus === 'ACTIVE') return result.Table;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Timed out while waiting for the product catalog table.');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const overwrite = process.argv.includes('--overwrite');
  const seedOnly = process.argv.includes('--seed-only');
  const [{ dynamoDbRequest }, store, catalog, productData] = await Promise.all([
    import('../lib/dynamoDb.js'),
    import('../lib/productCatalogStore.js'),
    import('../lib/productCatalog.js'),
    import('../src/data/products.js'),
  ]);
  const products = productData.products || [];
  const itemCount = products.reduce((total, product, index) => {
    const records = store.buildCatalogSeedItems(
      product,
      catalog.getProductSkuEntries(product),
      index
    );
    return (
      total +
      2 +
      records.variants.length +
      records.media.length
    );
  }, 0);

  console.log(`Product catalog table: ${TABLE_NAME}`);
  console.log('Primary key: pk (String) + sk (String)');
  console.log('Index: catalog-index (gsi1pk + gsi1sk)');
  console.log('Capacity: on-demand');
  console.log(`Products: ${products.length}`);
  console.log(`Catalog records: ${itemCount}`);

  if (!apply) {
    console.log(
      'Dry run only. Re-run with -- --apply to create and seed the table.'
    );
    console.log(
      'If an administrator already created the table, use -- --apply --seed-only.'
    );
    return;
  }

  if (seedOnly) {
    console.log(
      'Seed-only mode: skipping table inspection and creation.'
    );
  } else {
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
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
          { AttributeName: 'gsi1pk', AttributeType: 'S' },
          { AttributeName: 'gsi1sk', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'catalog-index',
            KeySchema: [
              { AttributeName: 'gsi1pk', KeyType: 'HASH' },
              { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
        Tags: [
          { Key: 'Application', Value: 'TheAvalancheHour' },
          { Key: 'Purpose', Value: 'ProductCatalog' },
        ],
      });
      await waitForActive(dynamoDbRequest);
      console.log('Created the dedicated product catalog table.');
    } else {
      console.log('The dedicated product catalog table already exists.');
    }
  }

  let seeded = 0;
  let preserved = 0;
  for (const [index, product] of products.entries()) {
    try {
      await store.seedCatalogProduct(
        product,
        catalog.getProductSkuEntries(product),
        index,
        { overwrite }
      );
      seeded += 1;
    } catch (error) {
      if (!overwrite && /conditional/i.test(String(error.message || ''))) {
        preserved += 1;
        continue;
      }
      throw error;
    }
  }

  console.log(
    `Product catalog seed complete. Seeded ${seeded}; preserved ${preserved} existing products.`
  );
  console.log(
    `Set DYNAMODB_PRODUCTS_TABLE=${TABLE_NAME} in each runtime environment.`
  );
}

main().catch((error) => {
  console.error('Product catalog setup failed:', formatSetupError(error));
  process.exitCode = 1;
});
