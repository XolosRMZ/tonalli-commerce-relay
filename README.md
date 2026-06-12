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

