# Tonalli Commerce Relay

Tonalli Commerce Relay is a sovereign commerce layer for eCash that allows users to buy goods and services from stores that do not yet accept XEC.

It uses:

- XEC as money
- Tonalli Wallet as identity
- Aliases as the social layer
- RMZ reputation as trust
- XEC escrow as settlement guarantee

> Where XEC is not accepted, Tonalli buys for you.

## Development API

## Database development

```bash
docker compose up -d
```

```bash
export DATABASE_URL="postgresql://tonalli:tonalli_dev_password@localhost:5432/tonalli_commerce_relay?schema=public"
```

```bash
pnpm --filter @xolosarmy/db prisma generate
```

```bash
pnpm --filter @xolosarmy/db prisma migrate dev --name init_users_auth_challenges
```

```bash
pnpm --filter @xolosarmy/db prisma studio
```


## Order persistence

### Order store

Default:

```bash
TONALLI_ORDER_STORE=memory
```

PostgreSQL:

```bash
TONALLI_ORDER_STORE=prisma
```

The Prisma order store requires `DATABASE_URL`, `docker compose`, and Prisma migrations.

### Evidence and dispute stores

Defaults:

```bash
TONALLI_EVIDENCE_STORE=memory
TONALLI_DISPUTE_STORE=memory
```

PostgreSQL:

```bash
TONALLI_EVIDENCE_STORE=prisma
TONALLI_DISPUTE_STORE=prisma
```

`POST /api/orders/[id]/purchase` and `POST /api/orders/[id]/ship` use `TONALLI_EVIDENCE_STORE` to persist submitted evidence. `POST /api/orders/[id]/dispute` and `POST /api/orders/[id]/resolve-dispute` use `TONALLI_DISPUTE_STORE` to persist the dispute lifecycle. The default is `memory`, so local happy-path scripts and development flows do not require a database.

The Prisma evidence and dispute stores require `DATABASE_URL`, `docker compose`, and Prisma migrations. Use `TONALLI_EVIDENCE_STORE=prisma` or `TONALLI_DISPUTE_STORE=prisma` only after the database schema has been migrated.

## Auth development

`TONALLI_AUTH_STORE=memory` is the default and uses the in-memory challenge store.

`TONALLI_AUTH_STORE=prisma` uses PostgreSQL for auth challenges and requires:

- `docker compose up -d`
- `DATABASE_URL` configured
- `prisma migrate dev` executed

TonalliAuth-v1 already has a dedicated `TonalliMessageVerifier` integration point for real wallet signatures. The current web verifier keeps `TONALLI_AUTH_DEV_BYPASS=true` support for smoke tests, while the real eCash signature implementation remains pending until Tonalli Wallet confirms the exact message, signature encoding, address format, public key recovery or address validation path, and compatible ECDSA/Schnorr algorithm.

### Prisma auth smoke test

```bash
docker compose up -d
```

```bash
export DATABASE_URL="postgresql://tonalli:tonalli_dev_password@localhost:5432/tonalli_commerce_relay?schema=public"
```

```bash
pnpm --filter @xolosarmy/db prisma migrate dev --name init_users_auth_challenges
```

```bash
TONALLI_AUTH_STORE=prisma TONALLI_AUTH_DEV_BYPASS=true DATABASE_URL="$DATABASE_URL" pnpm dev:web
```

In another terminal:

```bash
BASE_URL=http://localhost:3000 DATABASE_URL="$DATABASE_URL" bash scripts/auth-prisma-smoke.sh
```

### Prisma orders smoke test

```bash
docker compose up -d
```

```bash
export DATABASE_URL="postgresql://tonalli:tonalli_dev_password@localhost:5432/tonalli_commerce_relay?schema=public"
```

```bash
pnpm --filter @xolosarmy/db prisma migrate dev --name add_orders_escrow_events
```

```bash
TONALLI_ORDER_STORE=prisma DATABASE_URL="$DATABASE_URL" pnpm dev:web
```

In another terminal:

```bash
BASE_URL=http://localhost:3000 DATABASE_URL="$DATABASE_URL" bash scripts/orders-prisma-smoke.sh
```

### Prisma commerce flows

`scripts/prisma-commerce-flows.sh` only tests commerce persistence for orders, evidence, and disputes. Use `scripts/prisma-full-stack-flows.sh` when you need auth plus commerce in full Prisma mode.

```bash
docker compose up -d
```

```bash
export DATABASE_URL="postgresql://tonalli:tonalli_dev_password@localhost:5432/tonalli_commerce_relay?schema=public"
```

```bash
pnpm --filter @xolosarmy/db prisma migrate dev
```

```bash
TONALLI_ORDER_STORE=prisma \
TONALLI_EVIDENCE_STORE=prisma \
TONALLI_DISPUTE_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
DATABASE_URL="$DATABASE_URL" \
pnpm dev:web
```

In another terminal:

```bash
BASE_URL=http://localhost:3000 \
DATABASE_URL="$DATABASE_URL" \
TONALLI_ORDER_STORE=prisma \
TONALLI_EVIDENCE_STORE=prisma \
TONALLI_DISPUTE_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
bash scripts/prisma-commerce-flows.sh
```


## Full Prisma stack mode

This mode uses:

```bash
TONALLI_AUTH_STORE=prisma
TONALLI_AUTH_DEV_BYPASS=true
TONALLI_ORDER_STORE=prisma
TONALLI_EVIDENCE_STORE=prisma
TONALLI_DISPUTE_STORE=prisma
DATABASE_URL=...
```

Terminal 1:

```bash
docker compose up -d

export DATABASE_URL="postgresql://tonalli:tonalli_dev_password@localhost:5432/tonalli_commerce_relay?schema=public"

pnpm --filter @xolosarmy/db prisma migrate dev
pnpm --filter @xolosarmy/db prisma generate
```

Terminal 2:

```bash
export DATABASE_URL="postgresql://tonalli:tonalli_dev_password@localhost:5432/tonalli_commerce_relay?schema=public"

TONALLI_AUTH_STORE=prisma \
TONALLI_AUTH_DEV_BYPASS=true \
TONALLI_ORDER_STORE=prisma \
TONALLI_EVIDENCE_STORE=prisma \
TONALLI_DISPUTE_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
DATABASE_URL="$DATABASE_URL" \
pnpm dev:web
```

Terminal 3:

```bash
export DATABASE_URL="postgresql://tonalli:tonalli_dev_password@localhost:5432/tonalli_commerce_relay?schema=public"

BASE_URL=http://localhost:3000 \
DATABASE_URL="$DATABASE_URL" \
TONALLI_AUTH_STORE=prisma \
TONALLI_AUTH_DEV_BYPASS=true \
TONALLI_ORDER_STORE=prisma \
TONALLI_EVIDENCE_STORE=prisma \
TONALLI_DISPUTE_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
bash scripts/prisma-full-stack-flows.sh
```

## Happy path demo

```bash
pnpm dev:web
BASE_URL=http://localhost:3000 bash scripts/happy-path.sh
```

### Create auth challenge

POST `/api/auth/challenge`

### Verify auth challenge

POST `/api/auth/verify`

### Create commerce quote

POST `/api/quote`

```sh
curl -X POST http://localhost:3000/api/quote \
  -H "Content-Type: application/json" \
  -d '{"amount":100,"currency":"MXN","intermediaryFeePercent":5,"platformFeePercent":1,"networkFeeReserveXec":100}'
```

### Create draft order

POST `/api/orders`

```sh
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"buyerUserId":"user_123","buyerAddress":"ecash:q...","buyerAlias":"xolosarmy.xec","product":{"provider":"amazon_mx","productUrl":"https://amazon.com.mx/example","title":"Example product","quantity":1,"notes":"Color negro"},"quote":{"totalFiat":{"amount":106,"currency":"MXN"},"totalXec":{"amount":318100,"currency":"XEC"}}}'
```

### List orders

GET `/api/orders`

```sh
curl http://localhost:3000/api/orders
```

### Get order

GET `/api/orders/:id`

```sh
curl http://localhost:3000/api/orders/order-id
```

### Simulate order funding

POST `/api/orders/:id/fund`

```sh
curl -X POST http://localhost:3000/api/orders/order-id/fund \
  -H "Content-Type: application/json" \
  -d '{"buyer":{"userId":"user_123","address":"ecash:q...","publicKey":"..."},"simulatedDepositTxid":"dev-txid-123"}'
```

### Accept funded order

POST `/api/orders/:id/accept`

```sh
curl -X POST http://localhost:3000/api/orders/order-id/accept \
  -H "Content-Type: application/json" \
  -d '{"intermediary":{"userId":"merchant_123","address":"ecash:q...","alias":"merchant.xec"},"reputationProfile":{"userId":"merchant_123","alias":"merchant.xec","address":"ecash:q...","level":"alias_verified","score":25,"completedOrders":3,"completedEligibleOrders":2,"totalVolumeXec":500000,"totalVolumeFiatMxn":1200,"openDisputes":0,"wonDisputes":0,"lostDisputes":0,"limits":{"maxOrderFiatMxn":1000,"maxDailyFiatMxn":2000},"isFrozen":false,"updatedAt":"2026-06-12T00:00:00.000Z"},"currentDailyVolumeFiatMxn":0}'
```

### Mark order as purchased

POST `/api/orders/:id/purchase`

```sh
curl -X POST http://localhost:3000/api/orders/order-id/purchase \
  -H "Content-Type: application/json" \
  -d '{"intermediaryUserId":"merchant_123","evidence":{"type":"receipt","uri":"https://example.com/receipt.png","hash":"sha256-placeholder","notes":"Order placed successfully"},"externalOrderId":"AMZ-123456","purchasedAt":"2026-06-12T20:00:00.000Z"}'
```

### Mark order as shipped

POST `/api/orders/:id/ship`

```sh
curl -X POST http://localhost:3000/api/orders/order-id/ship \
  -H "Content-Type: application/json" \
  -d '{"intermediaryUserId":"merchant_123","tracking":{"carrier":"DHL","trackingNumber":"123456789","trackingUrl":"https://example.com/tracking/123456789","notes":"Package shipped"},"shippedAt":"2026-06-12T20:00:00.000Z"}'
```

### Request escrow release

POST `/api/orders/:id/release-request`

```sh
curl -X POST http://localhost:3000/api/orders/order-id/release-request \
  -H "Content-Type: application/json" \
  -d '{"intermediaryUserId":"merchant_123","message":"Product shipped and evidence submitted. Requesting escrow release.","requestedAt":"2026-06-12T20:00:00.000Z"}'
```

### Simulate escrow release

POST `/api/orders/:id/release`

```sh
curl -X POST http://localhost:3000/api/orders/order-id/release \
  -H "Content-Type: application/json" \
  -d '{"buyerUserId":"user_123","buyer":{"userId":"user_123","address":"ecash:q...","publicKey":"..."},"intermediary":{"userId":"merchant_123","address":"ecash:q...","publicKey":"..."},"simulatedReleaseTxid":"dev-release-txid-123","networkFeeXec":10}'
```

### Request refund

POST `/api/orders/:id/refund-request`

```sh
curl -X POST http://localhost:3000/api/orders/order-id/refund-request \
  -H "Content-Type: application/json" \
  -d '{"requestedByUserId":"merchant_123","reason":"Product out of stock","requestedAt":"2026-06-12T20:00:00.000Z"}'
```

### Simulate refund

POST `/api/orders/:id/refund`

```sh
curl -X POST http://localhost:3000/api/orders/order-id/refund \
  -H "Content-Type: application/json" \
  -d '{"buyerUserId":"user_123","buyer":{"userId":"user_123","address":"ecash:q...","publicKey":"..."},"intermediary":{"userId":"merchant_123","address":"ecash:q...","publicKey":"..."},"simulatedRefundTxid":"dev-refund-txid-123","networkFeeXec":10}'
```

### Open dispute

POST `/api/orders/:id/dispute`

```sh
curl -X POST http://localhost:3000/api/orders/order-id/dispute \
  -H "Content-Type: application/json" \
  -d '{"openedByUserId":"user_123","reason":"Product not received","evidence":[{"type":"conversation","uri":"https://example.com/evidence","hash":"sha256-placeholder"}],"openedAt":"2026-06-12T20:00:00.000Z"}'
```

### Resolve dispute

POST `/api/orders/:id/resolve-dispute`

```sh
curl -X POST http://localhost:3000/api/orders/order-id/resolve-dispute \
  -H "Content-Type: application/json" \
  -d '{"resolvedByUserId":"arb_dev","resolution":"refund_to_buyer","authority":"arbitrator","buyer":{"userId":"user_123","address":"ecash:q...","publicKey":"..."},"arbitrator":{"userId":"arb_dev","address":"ecash:q...","publicKey":"..."},"networkFeeXec":10,"simulatedTxid":"dev-dispute-resolution-txid","resolvedAt":"2026-06-12T20:00:00.000Z"}'
```

## Documentation
* [Database Schema Design](docs/DATABASE_SCHEMA.md)

Reputation persistence schema models exist in Prisma; engine adapters will be wired in a subsequent step.
