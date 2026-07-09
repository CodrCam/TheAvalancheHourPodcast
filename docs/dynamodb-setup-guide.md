# DynamoDB Store Setup Guide

This phase moves store inventory and order storage to DynamoDB while leaving the
old database paths available as local fallback code. Production should set both
`DYNAMODB_INVENTORY_TABLE` and `DYNAMODB_ORDERS_TABLE` so the store backend no
longer depends on Supabase/Postgres for inventory or orders.

## What the Code Expects

Inventory uses one table:

```txt
Table name: AvalancheHourInventory
Partition key: sku
Partition key type: String
Sort key: none
Capacity mode: On-demand
```

Each item should look like this:

```json
{
  "sku": "recap-cord-blue-grey",
  "quantity": 4,
  "hidden": false,
  "updated_at": "2026-07-01T20:00:00.000Z"
}
```

Only `sku` and `quantity` are required. Custom inventory rows may also store
`name`. Catalog rows can store `hidden: true` when a sold-out item should be
kept in admin but removed from the storefront. The admin UI will set
`updated_at` automatically when it saves inventory.

Orders use a second table:

```txt
Table name: AvalancheHourOrders
Partition key: order_id
Partition key type: String
Sort key: none
Capacity mode: On-demand
```

Each order item is written by the website. Important attributes include:

```json
{
  "order_id": "avh_abc123",
  "stripe_payment_intent_id": "pi_...",
  "status": "paid",
  "fulfillment_status": "new",
  "amount_cents": 6500,
  "items_json": "[{\"sku\":\"recap-cuff-black\",\"qty\":1}]",
  "customer_email": "customer@example.com",
  "shipping_name": "Customer Name",
  "created_at": "2026-07-01T20:00:00.000Z",
  "inventory_decremented": true
}
```

`inventory_decremented` prevents Stripe webhook retries from subtracting stock
more than once.

Homepage/site content uses a third table:

```txt
Table name: AvalancheHourSiteContent
Partition key: content_key
Partition key type: String
Sort key: none
Capacity mode: On-demand
```

The first item is seeded with `content_key` set to `homepage_cta`. It stores the
editable About page program story, homepage support message, community
spotlight, and Instagram call to action.

Sponsors use a fourth table:

```txt
Table name: AvalancheHourSponsors
Partition key: sponsor_id
Partition key type: String
Sort key: none
Capacity mode: On-demand
```

Each sponsor item includes:

```json
{
  "sponsor_id": "open-snow",
  "name": "OpenSnow",
  "tier": "friend",
  "url": "https://opensnow.com/",
  "logo": "/images/sponsors/OpenSnow.png",
  "active": true,
  "episode_ids_json": "[]",
  "sort_order": 10,
  "updated_at": "2026-07-01T20:00:00.000Z"
}
```

The supported tiers are `legacy`, `partner`, `friend`, and `episode`.
Inactive sponsors remain in admin but are hidden from public sponsor sections.
Any sponsor can also include `episode_ids_json` as a JSON array of Spotify
episode IDs. Those sponsors appear on the matching episode cards. In the admin
page, paste either the full Spotify episode URL or the episode ID; each saved ID
becomes a removable assignment chip.

`sort_order` is managed by the app. Existing sponsors keep their seed order, and
new sponsors are placed after existing sponsors in their tier.

Sponsor logos can be either:

- A site-relative path, such as `/images/sponsors/OpenSnow.png`.
- A public HTTPS image URL.
- A small uploaded image stored as a data URL in the sponsor row.

For uploaded logos, use a transparent PNG when possible, keep the image roughly
600px wide or smaller, and keep the file under 220 KB. Larger brand assets
should be resized before upload so the DynamoDB item stays comfortably below the
400 KB item limit.

Team members use a fifth table:

```txt
Table name: AvalancheHourPeople
Partition key: person_id
Partition key type: String
Sort key: none
Capacity mode: On-demand
```

Each team member item includes:

```json
{
  "person_id": "caleb-merrill",
  "slug": "caleb-merrill",
  "role": "host",
  "name": "Caleb Merrill",
  "title": "",
  "images_json": "[\"/images/hosts/caleb1.JPG\"]",
  "bio_short": "Founder/host of The Avalanche Hour...",
  "bio_full": "Full profile text...",
  "active": true,
  "needs_bio": false,
  "needs_images": false,
  "sort_order": 0,
  "updated_at": "2026-07-01T20:00:00.000Z"
}
```

Inactive people remain editable in admin but are hidden from the public About
page and profile routes. Images can be site-relative paths, public HTTPS URLs,
or small uploaded data URLs. For uploaded host images, keep files under 380 KB.

## Create the Tables

1. Open AWS Console.
2. Go to DynamoDB.
3. Make sure the region is `us-east-2` / US East (Ohio), matching Cognito.
4. Choose Tables.
5. Choose Create table.
6. Create `AvalancheHourInventory` with partition key `sku` as a String.
7. Do not add a sort key.
8. Capacity: choose On-demand.
9. Leave the rest as the defaults.
10. Create the table.
11. Create a second table named `AvalancheHourOrders`.
12. Use partition key `order_id` as a String.
13. Do not add a sort key.
14. Capacity: choose On-demand.
15. Leave the rest as the defaults.
16. Create the table.
17. Create a third table named `AvalancheHourSiteContent`.
18. Use partition key `content_key` as a String.
19. Do not add a sort key.
20. Capacity: choose On-demand.
21. Leave the rest as the defaults.
22. Create the table.
23. Create a fourth table named `AvalancheHourSponsors`.
24. Use partition key `sponsor_id` as a String.
25. Do not add a sort key.
26. Capacity: choose On-demand.
27. Leave the rest as the defaults.
28. Create the table.
29. Create a fifth table named `AvalancheHourPeople`.
30. Use partition key `person_id` as a String.
31. Do not add a sort key.
32. Capacity: choose On-demand.
33. Leave the rest as the defaults.
34. Create the table.

## Create the App Access Key

Use a dedicated IAM user or role for the website. Do not use your root AWS
account keys.

Create a policy with this permission scope:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:BatchGetItem",
        "dynamodb:DeleteItem",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Scan",
        "dynamodb:UpdateItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-2:426018612622:table/AvalancheHourInventory",
        "arn:aws:dynamodb:us-east-2:426018612622:table/AvalancheHourOrders",
        "arn:aws:dynamodb:us-east-2:426018612622:table/AvalancheHourSiteContent",
        "arn:aws:dynamodb:us-east-2:426018612622:table/AvalancheHourSponsors",
        "arn:aws:dynamodb:us-east-2:426018612622:table/AvalancheHourPeople"
      ]
    }
  ]
}
```

Then create an access key for that app user.

## Add Server Environment Variables

Add these only to the server environment, never to browser/client env:

```txt
DYNAMODB_REGION=us-east-2
DYNAMODB_ACCESS_KEY_ID=your_access_key_id
DYNAMODB_SECRET_ACCESS_KEY=your_secret_access_key
DYNAMODB_INVENTORY_TABLE=AvalancheHourInventory
DYNAMODB_ORDERS_TABLE=AvalancheHourOrders
DYNAMODB_SITE_CONTENT_TABLE=AvalancheHourSiteContent
DYNAMODB_SPONSORS_TABLE=AvalancheHourSponsors
DYNAMODB_PEOPLE_TABLE=AvalancheHourPeople
```

For local testing, put them in `.env.local`. For deployment, add them in the
hosting provider's server-side environment variables.

## Seed Homepage Site Content

After creating `AvalancheHourSiteContent` and adding
`DYNAMODB_SITE_CONTENT_TABLE` locally, run a dry run first:

```bash
npm run seed:dynamo-site-content
```

Then write the default homepage CTA content:

```bash
npm run seed:dynamo-site-content -- --apply
```

## Seed Sponsors

After creating `AvalancheHourSponsors` and adding
`DYNAMODB_SPONSORS_TABLE` locally, run a dry run first:

```bash
npm run seed:dynamo-sponsors
```

Then write the sponsor seed:

```bash
npm run seed:dynamo-sponsors -- --apply
```

## Seed Team Members

After creating `AvalancheHourPeople` and adding `DYNAMODB_PEOPLE_TABLE`
locally, run a dry run first:

```bash
npm run seed:dynamo-people
```

Then write the team seed:

```bash
npm run seed:dynamo-people -- --apply
```

## Seed Inventory

After the table exists and the env values are set, export the current
Supabase/Postgres inventory into seed files:

```bash
npm run export:supabase-inventory
```

This creates:

```txt
data/dynamodb-inventory-seed.json
data/dynamodb-inventory-seed.csv
```

Dry-run the DynamoDB seed:

```bash
npm run seed:dynamo-inventory
```

Apply the seed to DynamoDB:

```bash
npm run seed:dynamo-inventory -- --apply
```

Then:

1. Start the site locally.
2. Open `/admin/inventory`.
3. Confirm all inventory rows appear.
4. Change one low-risk SKU quantity.
5. Refresh the page to confirm the change persists in DynamoDB.

Current known store SKUs include:

```txt
recap-trucker-gold-dirt
recap-cord-blue-grey
recap-cord-sage-purp
recap-cord-yellow
recap-cord-teal
recap-pom-blue
recap-pom-green
recap-pom-brown
recap-cuff-black
recap-cuff-blue
recap-cuff-purp
strap-20-black
strap-25-blue
hoodie-blue-storm-s
hoodie-blue-storm-m
hoodie-blue-storm-l
hoodie-blue-storm-xl
hoodie-dark-grey-heather-s
hoodie-dark-grey-heather-m
hoodie-dark-grey-heather-l
hoodie-dark-grey-heather-xl
free-range-tote
ah-hat-black-camo
ah-hat-blue
ah-hat-blue-mesh
ah-hat-green-cord
ah-sticker-logo
```

The current Supabase export contains one extra old/unused SKU,
`tote-free-range-canvas`, with quantity `0`. It is harmless to seed, but it is
not used by the current product catalog. The live tote SKU is `free-range-tote`.

## Seed Historical Orders

After the orders table exists and the env values are set, export historical
Supabase/Postgres orders into seed files:

```bash
npm run export:supabase-orders
```

This creates:

```txt
data/dynamodb-orders-seed.json
data/dynamodb-orders-seed.csv
```

Dry-run the DynamoDB order seed:

```bash
npm run seed:dynamo-orders
```

Apply the seed to DynamoDB:

```bash
npm run seed:dynamo-orders -- --apply
```

The order seed skips existing DynamoDB orders by default, which protects any
new live orders that already landed in DynamoDB. To intentionally overwrite
existing DynamoDB order rows, use:

```bash
npm run seed:dynamo-orders -- --apply --overwrite
```

## How the Switch Works

- Inventory uses DynamoDB when `DYNAMODB_INVENTORY_TABLE` is set.
- Admin inventory, public stock checks, checkout validation, and paid-order
  inventory decrement all use the same adapter.
- Orders use DynamoDB when `DYNAMODB_ORDERS_TABLE` is set. Order recording,
  admin order list, order status updates, and the CSV export all use the same
  orders adapter.
- Site content uses DynamoDB when `DYNAMODB_SITE_CONTENT_TABLE` is set. The
  public homepage and About page keep static defaults if managed content is
  unavailable.
- Sponsors use DynamoDB when `DYNAMODB_SPONSORS_TABLE` is set. Public sponsor
  sections keep the static sponsor list as a fallback if managed sponsors are
  unavailable.
- Team members use DynamoDB when `DYNAMODB_PEOPLE_TABLE` is set. Public team
  pages keep the built-in people list as a fallback if managed people are
  unavailable.
- If an inventory or orders DynamoDB table variable is missing, the server fails
  loudly instead of silently writing to Supabase.

For production, set all five table variables so DynamoDB is the live store
backend. Old Supabase export scripts may still use `SUPABASE_DB_URL` locally for
one-off migration work, but it is not part of normal Netlify runtime config.
