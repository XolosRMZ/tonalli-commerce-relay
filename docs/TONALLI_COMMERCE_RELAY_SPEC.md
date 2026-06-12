# Tonalli Commerce Relay Specification

## Tesis

Tonalli Commerce Relay es una red de comercio soberano que permite comprar bienes y servicios en tiendas que todavia no aceptan eCash, usando XEC como dinero, Tonalli Wallet como identidad, alias como capa social, reputacion RMZ como confianza y escrow on-chain como garantia.

> Donde no aceptan XEC, Tonalli compra por ti.

## 1. Vision

Tonalli Commerce Relay no es un clon de Bitgree ni de Local eCash. Es una capa nativa del ecosistema Tonalli para coordinar identidad, alias, reputacion, ordenes, arbitraje y settlement en XEC desde un modelo propio.

`xolosArmy/local-ecash` podra usarse como referencia tecnica futura para disenar escrow XEC, pero este repositorio es nuevo, limpio y propio.

## 2. Roles del Sistema

- Buyer: usuario que quiere comprar bienes o servicios en una tienda que todavia no acepta XEC.
- Intermediary: participante aprobado que ejecuta la compra en moneda local o en el metodo aceptado por la tienda.
- Arbitrator: actor autorizado para resolver disputas con evidencia objetiva.
- Moderator: actor operativo para controlar abuso, fraude, reportes y calidad del marketplace.

## 3. Flujo de Compra

El flujo inicial contempla login con TonalliAuth-v1, creacion de orden, cotizacion MXN->XEC, fondeo de escrow, aceptacion por intermediario, evidencia de compra, entrega o envio, liberacion de fondos y actualizacion de reputacion.

## 4. Estados de Orden

- WAITING_DEPOSIT
- FUNDED
- ACCEPTED
- PURCHASED
- SHIPPED
- RELEASE_PENDING
- RELEASED
- REFUND_PENDING
- REFUNDED
- DISPUTED
- CANCELLED

## 5. Escrow XEC

El modulo de escrow vivira en `packages/escrow-core`. Usara el modelo UTXO de eCash y debera mantener separadas las reglas de contrato, construccion de transacciones, validacion de estados y politicas de arbitraje.

`xolosArmy/local-ecash` sera referencia tecnica futura para el diseno de escrow XEC. No debe tratarse como fork ni como base directa del producto.

Ninguna transaccion de release, refund o dispute debe requerir fondos externos del arbitrator, moderator o intermediary. Las comisiones y salidas necesarias deben contemplarse desde el fondeo o desde la estructura del escrow.

## 6. Tonalli Wallet Auth

TonalliAuth-v1 define autenticacion por challenge firmado con Tonalli Wallet. El challenge incluye `domain`, `address`, `alias`, `nonce`, `issuedAt`, `expirationTime`, `purpose`, `network` y `version`.

El backend debe emitir nonces criptograficamente seguros, persistirlos, marcar uso, revocar cuando aplique y prevenir replay. Las firmas deben expresar intencion clara y no deben reutilizarse para acciones distintas.

TODO: integrar verificacion real con `tonalli-core` cuando el contrato de autenticacion este estable.

## 7. Alias

Alias -> Address -> PublicKey -> Reputation Profile.

El alias es la capa social visible. La address vincula control criptografico. La public key permite verificacion. El perfil de reputacion agrega historial y confianza.

## 8. Reputacion

Modelo hibrido:

- Reputacion viva en PostgreSQL.
- Reputacion simbolica/auditable on-chain.

La reputacion viva se calcula off-chain; la reputacion simbolica y auditable se ancla on-chain.

## 9. Disputas

Las disputas deben resolverse con evidencia objetiva: comprobantes, estado de orden, confirmaciones, timestamps, evidencia de envio, evidencia de recepcion y mensajes relevantes. El arbitraje debe producir decisiones trazables y penalizaciones proporcionales.

## 10. Modelo Antifraude

- Nivel 0 Nuevo: $300 MXN por orden, $500 MXN diario.
- Nivel 1 Alias Verificado: $1,000 MXN por orden, $2,000 MXN diario.
- Nivel 2 Intermediario Confiable: $3,000 MXN por orden, $7,500 MXN diario.
- Nivel 3 Comerciante Tonalli: $10,000 MXN por orden, $25,000 MXN diario.
- Nivel 4+ Nodo Comercial: limites personalizados y aprobacion manual.

## 11. Privacidad

No publicar en cadena nombres reales, direcciones, productos, comprobantes, tracking completo ni conversaciones privadas.

## 12. MVP

Beta cerrada, Tonalli Wallet, alias obligatorio, ordenes manuales, Amazon MX/Mercado Libre/Walmart, cotizacion MXN->XEC, escrow funcional, intermediarios aprobados manualmente, reputacion en PostgreSQL, badges seleccionados on-chain.

## 13. Roadmap

- Fase 1 MVP cerrado.
- Fase 2 Marketplace controlado.
- Fase 3 Reputacion portable.
- Fase 4 Expansion LATAM.

## 14. Principios Fundacionales

XEC es el dinero.

Tonalli Wallet es la identidad.

El alias es la capa social.

La reputacion es la confianza.

El escrow es la garantia.
