# Tonalli WalletConnect Auth Flow

This spike validates the TonalliAuth identity cycle from the relay frontend to a wallet connector adapter, then back through the existing auth verification endpoint. It does not change escrow, commerce, orders, or reputation behavior.

## Flow

1. The relay frontend asks the user for an eCash address and optional alias.
2. The frontend calls `POST /api/auth/challenge`.
3. The backend creates a `TonalliAuth-v1` challenge and returns the exact signing message.
4. The wallet connector signs that exact message with `ecash_signMessage`.
5. The frontend receives a signature from the wallet connector.
6. The frontend calls `POST /api/auth/verify` with the challenge nonce and signature.
7. The backend rebuilds the signing message from the stored challenge and verifies the signature.

## `POST /api/auth/challenge`

Request:

```json
{
  "address": "ecash:...",
  "alias": "optional-alias"
}
```

Response:

```json
{
  "challenge": {
    "domain": "localhost:3000",
    "address": "ecash:...",
    "alias": "optional-alias",
    "nonce": "...",
    "issuedAt": "...",
    "expirationTime": "...",
    "purpose": "authentication",
    "network": "eCash",
    "version": "TonalliAuth-v1"
  },
  "message": "Sign in to Tonalli Commerce Relay\n..."
}
```

The returned `message` is the exact payload that must be signed.

## Wallet Connector Contract

Expected WalletConnect namespace:

```text
ecash:1
```

Expected RPC method:

```text
ecash_signMessage
```

Proposed wallet request payload:

```json
{
  "address": "ecash:...",
  "message": "..."
}
```

Expected wallet response:

```json
{
  "signature": "..."
}
```

The frontend now selects a connector through `NEXT_PUBLIC_TONALLI_WALLET_CONNECTOR`. Use `mock` for the development connector, or `walletconnect` for the real WalletConnect adapter. The mock connector returns `dev-valid-signature` for a non-empty message and an address that starts with `ecash:`.

## `POST /api/auth/verify`

The current backend endpoint expects the stored challenge nonce and the wallet signature:

```json
{
  "nonce": "...",
  "signature": "..."
}
```

Successful response:

```json
{
  "valid": true,
  "address": "ecash:...",
  "alias": "optional-alias"
}
```

Failed response:

```json
{
  "valid": false,
  "reason": "..."
}
```

For the mock signature to validate, run the server with:

```bash
TONALLI_AUTH_DEV_BYPASS=true
```

## Frontend environment

```bash
NEXT_PUBLIC_TONALLI_WALLET_CONNECTOR=mock
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_TONALLI_WC_RELAY_URL=... # optional
```

When `NEXT_PUBLIC_TONALLI_WALLET_CONNECTOR=walletconnect`, the relay initializes `/universal-provider` in the browser, requests namespace `ecash` on chain `ecash:1`, and sends `ecash_signMessage` with `{ address, message }`. The expected result is a non-empty base64 signature string.

## Pending

- Add a golden fixture signed by RMZWallet/Tonalli Wallet.
- Confirm the real RMZWallet/Tonalli Wallet project id and mobile/deep-link behavior in a manual WalletConnect session.
- Confirm the golden signature fixture from RMZWallet/Tonalli Wallet.
