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
