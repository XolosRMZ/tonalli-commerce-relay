# Tonalli Commerce Relay: Database Schema Design

Este documento define la arquitectura de persistencia para Tonalli Commerce Relay, sirviendo como guía antes de la implementación técnica con PostgreSQL y un ORM (Prisma/Drizzle).

## 1. Principios de Diseño
* **PostgreSQL como Fuente de Verdad:** Todo el estado de la aplicación reside aquí.
* **Cero Secretos Privados:** No se almacenarán llaves privadas (WIF/Seed phrases) bajo ninguna circunstancia. El relay es un ente no custodial.
* **Firmas Estrictas:** No se guardarán firmas ambiguas sin su respectivo `domain`, `purpose` y `version`.
* **Evidencia Off-Chain:** Las imágenes, recibos y conversaciones se almacenan off-chain (o en IPFS/AWS S3). En la base de datos sólo se guardan URIs y Hashes.
* **Anclaje On-Chain Limitado:** Sólo hashes, TXIDs y badges de reputación críticos justifican almacenamiento on-chain.
* **IDs Universales:** Todas las tablas principales utilizan `UUID` para sus llaves primarias.
* **Timestamps Precisos:** Todas las fechas usan formato ISO (`timestamptz` en PostgreSQL).
* **Paridad de Tipos:** Los estados de la base de datos deben mapear 1:1 con los tipos estáticos definidos en `@xolosarmy/models`.

---

## 2. Tablas Principales

### `users`
* **Propósito:** Almacenar la identidad base y llaves públicas de los actores del sistema.
* **Columnas:** `id` (UUID, PK), `address` (String, Unique), `alias` (String, Nullable, Unique), `role` (String), `is_frozen` (Boolean), `created_at`, `updated_at`.
* **Índices:** `address`, `alias`.
* **Notas:** `address` debe ser validado estrictamente en formato eCash (`ecash:q...` o `ecash:p...`).

### `auth_challenges`
* **Propósito:** Almacenar y rastrear el ciclo de vida de los nonces criptográficos para prevenir replay attacks.
* **Columnas:** `id` (UUID, PK), `nonce` (String, Unique), `domain` (String), `address` (String), `used_at` (Timestamptz, Nullable), `revoked_at` (Timestamptz, Nullable), `expires_at` (Timestamptz), `created_at`.
* **Índices:** `nonce`, `address`.

### `orders`
* **Propósito:** Registro central del flujo comercial. El schema Prisma ya existe, pero los endpoints del MVP siguen usando el store in-memory hasta que se habilite la persistencia.
* **Columnas Prisma:** `id` (String, PK), `buyerUserId` (String), `intermediaryUserId` (String, Nullable), `arbitratorUserId` (String, Nullable), `moderatorUserId` (String, Nullable), `status` (String), `disputeStatus` (String), `product` (Json), `quote` (Json), `createdAt`, `updatedAt`.
* **Índices:** `status`, `buyerUserId`, `intermediaryUserId`, `createdAt`.
* **Relaciones:** One-to-one opcional con `EscrowRecord`; one-to-many con `OrderEvent`.
* **Notas:** `product` y `quote` conservan la forma del MVP mientras se prepara el adapter de persistencia.

### `escrow_records`
* **Propósito:** Vincular la orden comercial con los artefactos criptográficos y transacciones on-chain.
* **Columnas Prisma:** `id` (String, PK, `uuid()`), `orderId` (String, Unique), `escrowAddress` (String, Nullable), `escrowScriptHex` (String, Nullable), `depositTxid` (String, Nullable), `releaseTxid` (String, Nullable), `refundTxid` (String, Nullable), `nonce` (String, Nullable), `createdAt`, `updatedAt`.
* **Índices:** `depositTxid`, `releaseTxid`, `refundTxid`.
* **Relaciones:** One-to-one requerida con `Order` por `orderId`.

### `order_events`
* **Propósito:** Event Sourcing. Historial inmutable de cada cambio de estado en una orden.
* **Columnas Prisma:** `id` (String, PK, `uuid()`), `orderId` (String), `type` (String), `actorUserId` (String, Nullable), `payload` (Json, Nullable), `createdAt`.
* **Índices:** `orderId`, `type`, `createdAt`, compuesto `[orderId, createdAt]`.
* **Relaciones:** Many-to-one con `Order`.

### `order_evidence`
* **Propósito:** Registro de evidencias logísticas aportadas por el intermediario.
* **Columnas:** `id` (UUID, PK), `order_id` (UUID, FK), `submitted_by_user_id` (UUID, FK), `evidence_type` (String), `uri` (String, Nullable), `hash` (String, Nullable), `notes` (Text, Nullable), `external_order_id` (String, Nullable), `created_at`.
* **Índices:** `order_id`.
* **Notas:** `uri` no debe exponer datos sensibles en texto plano si se planea hacer publico.

### `reputation_profiles`
* **Propósito:** Puntuación, límites operativos y métricas de vida de un intermediario.
* **Columnas:** `id` (UUID, PK), `user_id` (UUID, FK, Unique), `level` (String), `score` (Integer), `completed_orders` (Integer), `total_volume_xec` (Decimal), `total_volume_fiat_mxn` (Decimal), `open_disputes` (Integer), `won_disputes` (Integer), `lost_disputes` (Integer), `max_order_fiat_mxn` (Decimal), `max_daily_fiat_mxn` (Decimal), `updated_at`.
* **Índices:** `user_id`, `score`.

### `reputation_events`
* **Propósito:** Historial inmutable del porqué cambió el score de un usuario.
* **Columnas:** `id` (UUID, PK), `user_id` (UUID, FK), `order_id` (UUID, FK, Nullable), `point_change` (Integer), `reason` (String), `created_at`.
* **Índices:** `user_id`, `created_at`.

### `disputes`
* **Propósito:** Registro de desacuerdos comerciales y arbitraje.
* **Columnas:** `id` (UUID, PK), `order_id` (UUID, FK, Unique), `status` (String), `opened_by_user_id` (UUID, FK), `resolved_by_user_id` (UUID, FK, Nullable), `resolution_route` (String, Nullable), `created_at`, `updated_at`.
* **Índices:** `order_id`, `status`.

### `dispute_events`
* **Propósito:** Historial de la resolución de la disputa.
* **Columnas:** `id` (UUID, PK), `dispute_id` (UUID, FK), `actor_user_id` (UUID, FK), `event_type` (String), `payload` (JSONB), `created_at`.
* **Índices:** `dispute_id`.

---

## 3. Estados de Orders y Evidencia

**Order Statuses (Enum):**
- `WAITING_DEPOSIT`
- `FUNDED`
- `ACCEPTED`
- `PURCHASED`
- `SHIPPED`
- `RELEASE_PENDING`
- `RELEASED`
- `REFUND_PENDING`
- `REFUNDED`
- `DISPUTED`
- `CANCELLED`

**Evidence Types (Enum):**
- `receipt`
- `tracking`
- `delivery_confirmation`
- `conversation`
- `txid`
- `other`

**Escrow Routes (Enum):**
- `buyer_confirms_release`
- `voluntary_refund`
- `arbitrator_release_to_intermediary`
- `arbitrator_refund_to_buyer`
- `moderator_release_to_intermediary`
- `moderator_refund_to_buyer`

---

## 4. Invariantes Importantes (Application Logic constraints)
1. **Inmutabilidad Terminal:** Una orden `RELEASED` no puede volver a `REFUNDED`. Una orden `REFUNDED` no puede volver a `RELEASED`.
2. **Separación de Roles:** `buyerUserId` **nunca** puede ser igual a `intermediaryUserId` en la misma orden.
3. **Nonces Únicos:** Los nonces de `auth_challenges` se usan una sola vez (`used_at` flag previene replay).
4. **Resolución Única:** Una `dispute` sólo puede resolverse una vez.
5. **Privacidad de Evidencia:** `evidence` no debe incluir datos sensibles (PII) en texto plano si se va a anclar on-chain (sólo hashes).

---

## 5. MVP Migration Order
Para introducir PostgreSQL de forma iterativa sin romper el MVP in-memory, este es el orden de creación de modelos:
1. `users`
2. `auth_challenges`
3. `orders`
4. `escrow_records`
5. `order_events`
6. `order_evidence`
7. `reputation_profiles`
8. `reputation_events`
9. `disputes`
10. `dispute_events`
