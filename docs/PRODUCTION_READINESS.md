# Tonalli Commerce Relay Production Readiness

## Environment variables

- `DATABASE_URL`: PostgreSQL URL for Prisma stores.
- `TONALLI_AUTH_STORE`: `memory` or `prisma`.
- `TONALLI_AUTH_DEV_BYPASS`: development-only bypass for `dev-valid-signature`.
- `TONALLI_REQUIRE_AUTH`: set `true` to require TonalliAuth sessions.
- `TONALLI_AUTH_SESSION_SECRET`: required in production for session cookies.
- `TONALLI_AUTH_SESSION_MAX_AGE_SECONDS`: optional, defaults to 24 hours.
- `TONALLI_ORDER_STORE`: `memory` or `prisma`.
- `TONALLI_EVIDENCE_STORE`: `memory` or `prisma`.
- `TONALLI_DISPUTE_STORE`: `memory` or `prisma`.
- `TONALLI_REPUTATION_STORE`: `memory` or `prisma`.
- `ALLOWED_DOMAINS`: comma-separated allowed Host values.
- `ALLOWED_ORIGINS`: comma-separated allowed browser origins.
- `TONALLI_RATE_LIMIT_ENABLED`: set `false` to disable the memory limiter.
- `TONALLI_ARBITRATOR_USER_IDS`: comma-separated authorized arbitrator user IDs.
- `TONALLI_MODERATOR_USER_IDS`: comma-separated authorized moderator user IDs.
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: WalletConnect Cloud project id.
- `NEXT_PUBLIC_TONALLI_WALLET_CONNECTOR`: `mock` or `walletconnect`.
- `NEXT_PUBLIC_TONALLI_WC_RELAY_URL`: optional WalletConnect relay URL.

## Development mode

Use memory stores by default:

```bash
TONALLI_AUTH_DEV_BYPASS=true \
TONALLI_REQUIRE_AUTH=false \
pnpm dev:web
```

Legacy smoke scripts keep working when `TONALLI_REQUIRE_AUTH=false`:

```bash
BASE_URL=http://localhost:3000 bash scripts/happy-path.sh
BASE_URL=http://localhost:3000 bash scripts/refund-path.sh
BASE_URL=http://localhost:3000 bash scripts/dispute-path.sh
```

## Authenticated development smoke tests

```bash
TONALLI_AUTH_DEV_BYPASS=true \
TONALLI_REQUIRE_AUTH=true \
TONALLI_AUTH_SESSION_SECRET=test-secret \
TONALLI_ARBITRATOR_USER_IDS=ecash:qautharbitratoraddressplaceholder0000000 \
pnpm dev:web
```

```bash
BASE_URL=http://localhost:3000 bash scripts/authenticated-happy-path.sh
BASE_URL=http://localhost:3000 bash scripts/authenticated-refund-path.sh
BASE_URL=http://localhost:3000 bash scripts/authenticated-dispute-path.sh
```

## Prisma full stack mode

```bash
docker compose up -d
export DATABASE_URL="postgresql://tonalli:tonalli_dev_password@localhost:5432/tonalli_commerce_relay?schema=public"
pnpm --filter @xolosarmy/db prisma migrate dev
pnpm --filter @xolosarmy/db prisma generate
```

```bash
TONALLI_AUTH_STORE=prisma \
TONALLI_AUTH_DEV_BYPASS=true \
TONALLI_REQUIRE_AUTH=true \
TONALLI_AUTH_SESSION_SECRET=test-secret \
TONALLI_ORDER_STORE=prisma \
TONALLI_EVIDENCE_STORE=prisma \
TONALLI_DISPUTE_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
TONALLI_ARBITRATOR_USER_IDS=ecash:qautharbitratoraddressplaceholder0000000 \
DATABASE_URL="$DATABASE_URL" \
pnpm dev:web
```

```bash
BASE_URL=http://localhost:3000 \
DATABASE_URL="$DATABASE_URL" \
TONALLI_AUTH_STORE=prisma \
TONALLI_AUTH_DEV_BYPASS=true \
TONALLI_REQUIRE_AUTH=true \
TONALLI_ORDER_STORE=prisma \
TONALLI_EVIDENCE_STORE=prisma \
TONALLI_DISPUTE_STORE=prisma \
TONALLI_REPUTATION_STORE=prisma \
bash scripts/prisma-full-stack-flows.sh
```

## Production mode

Production requires:

```bash
DATABASE_URL=...
TONALLI_AUTH_STORE=prisma
TONALLI_AUTH_DEV_BYPASS=false
TONALLI_REQUIRE_AUTH=true
TONALLI_AUTH_SESSION_SECRET=...
TONALLI_ORDER_STORE=prisma
TONALLI_EVIDENCE_STORE=prisma
TONALLI_DISPUTE_STORE=prisma
TONALLI_REPUTATION_STORE=prisma
ALLOWED_DOMAINS=xolosarmy.xyz,www.xolosarmy.xyz
ALLOWED_ORIGINS=https://xolosarmy.xyz,https://www.xolosarmy.xyz
TONALLI_RATE_LIMIT_ENABLED=true
```

`TONALLI_AUTH_DEV_BYPASS=true` is rejected in production. Missing session
secret, allowed domains, allowed origins, database URL, or
`TONALLI_REQUIRE_AUTH=true` also fails production validation.

## Wallet auth page

Mock:

```bash
TONALLI_AUTH_DEV_BYPASS=true \
NEXT_PUBLIC_TONALLI_WALLET_CONNECTOR=mock \
pnpm dev:web
```

Open `http://localhost:3000/auth/wallet`.

WalletConnect:

```bash
NEXT_PUBLIC_TONALLI_WALLET_CONNECTOR=walletconnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

The dApp requests namespace `ecash`, chain `ecash:1`, method
`ecash_signMessage`, and params `{ address, message }`. The expected result is a
non-empty base64 signature string.

## Healthcheck

`GET /api/healthz` returns service status and a database status of `ok`,
`skipped`, or `error`. It does not expose credentials or database error details.

## Current audit findings

`pnpm audit` currently reports:

- High: `esbuild` via `vitest > vite`, patched in `esbuild >=0.28.1`.
- Low: `esbuild` via `vitest > vite`, patched in `esbuild >=0.28.1`.
- Moderate: `postcss` via `next`, patched in `postcss >=8.5.10`.

These are transitive dependency findings and should be addressed with dependency
upgrades after validating Next/Vite compatibility.

## Still pending

- Real XEC escrow implementation.
- Chronik broadcast and confirmation tracking.
- Transaction-level signatures for commerce actions.
- Golden real RMZWallet/Tonalli Wallet signature fixture.
- External security review.
