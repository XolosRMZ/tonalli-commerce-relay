# TonalliAuth Real Signature Verification Research

Fecha de investigacion: 2026-06-13.

## Estado actual

Este monorepo no contiene codigo de Tonalli Wallet ni una implementacion cliente de
`signMessage`. Las referencias locales a wallet, firma y public key estan en:

- `packages/tonalli-auth`: contrato de challenge, formateo de mensaje y punto de
  extension `TonalliMessageVerifier`.
- `apps/web/src/server/auth`: verificador web actual con bypass de desarrollo y
  placeholder `EcashMessageVerifier`.
- `README.md` y `docs/TONALLI_COMMERCE_RELAY_SPEC.md`: documentan que la
  verificacion real queda pendiente hasta confirmar el contrato de Tonalli
  Wallet.

El runtime actual no verifica firmas reales. `apps/web/src/server/auth/verify-message.ts`
acepta solamente `dev-valid-signature` cuando `TONALLI_AUTH_DEV_BYPASS=true`.
`apps/web/src/server/auth/ecash-message-verifier.ts` retorna `false` y lista los
pendientes: mensaje exacto, encoding de signature, formato de address, recuperacion
de public key o validacion contra address, y algoritmo ECDSA/Schnorr compatible
con eCash.

No se encontraron referencias locales a `signMessage`, `verifyMessage`,
`Schnorr` o `ECDSA` fuera de notas/TODOs y nombres de campos. La busqueda de
`signature`, `publicKey`, `address`, `ecash`, `cashtab` y `wallet` no encontro
codigo de wallet en este monorepo.

## Formato TonalliAuth-v1

El challenge actual se crea en `packages/tonalli-auth/src/challenge.ts` con:

- `domain`
- `address`
- `alias` opcional
- `nonce`
- `issuedAt`
- `expirationTime`
- `purpose: "authentication"`
- `network: "eCash"`
- `version: "TonalliAuth-v1"`

El mensaje exacto que se pasa hoy al verifier es:

```text
Sign in to Tonalli Commerce Relay

Domain: <domain>
Address: <address>
Alias: <alias>
Nonce: <nonce>
Issued At: <issuedAt>
Expiration: <expirationTime>
Purpose: authentication
Network: eCash
Version: TonalliAuth-v1
```

La linea `Alias: <alias>` se omite por completo cuando `alias` no existe. Las
fechas son ISO strings emitidos por `Date.toISOString()`. Este mensaje ya esta
cubierto por tests y `verifyAuthSignature` lo entrega al `TonalliMessageVerifier`
junto con `address` y `signature`.

## Formato de firma probable

Como no hay codigo local de Tonalli Wallet, el formato real debe confirmarse con
una fixture de Tonalli Wallet. La opcion mas compatible con eCash hoy es el
formato de `ecash-lib`:

- Preparar el mensaje con prefijo `"\x16eCash Signed Message:\n"`.
- Codificar el mensaje UTF-8.
- Construir `[prefix][message_length_varint][message]`.
- Firmar `sha256d` de ese payload.
- Usar firma ECDSA recuperable de 65 bytes.
- Serializar la firma como base64.
- Verificar recuperando la public key desde la firma y comparando
  `hash160(recoveredPublicKey)` contra el hash de la address eCash.

La API publicada de `ecash-lib@4.12.0` expone:

```ts
magicHash(message: string, messagePrefix?: string): Uint8Array
signMsg(msg: string, sk: Uint8Array, prefix?: string): string
verifyMsg(msg: string, signature: string, address: string, prefix?: string): boolean
```

`verifyMsg` recibe `msg`, `signature` y `address`; no requiere `publicKey` porque
la recupera desde la firma. Internamente usa `Address.fromCashAddress(address)`,
por lo que valida contra una address cashaddr de eCash, no contra un campo
`publicKey` externo.

Conclusion provisional: TonalliAuth-v1 deberia firmar exactamente el mensaje
canonico actual con eCash message signing estilo `ecash-lib.signMsg`, enviar
`signature` base64, y validar con `ecash-lib.verifyMsg(message, signature,
address)`.

## Preguntas abiertas

- Confirmar si Tonalli Wallet ya usa `ecash-lib.signMsg` o una API equivalente.
- Confirmar si el nombre expuesto al cliente sera `signMessage`, `signMsg` u otro.
- Obtener una fixture real con `address`, `message` exacto y `signature`.
- Confirmar si Tonalli Wallet firma el mensaje raw TonalliAuth-v1 o aplica otro
  prefijo/canonicalizacion antes de firmar.
- Confirmar si la signature enviada por wallet es base64 de 65 bytes recuperables
  o algun formato alternativo como hex, compact sin recovery id, DER, o Schnorr.
- Confirmar si se debe aceptar solo prefix `ecash:` mainnet o tambien `ectest:`
  y `ecregtest:` para ambientes no productivos.
- Confirmar si TonalliAuth debe exigir `publicKey` en la solicitud. Con
  `ecash-lib.verifyMsg` no es necesario para autenticacion por address.

## Opciones de implementacion

### `ecash-lib`

- Version observada: `4.12.0`.
- Mantenimiento: paquete de Bitcoin ABC, modificado en npm el 2026-04-01.
- API probable: `verifyMsg(message, signature, address)` para message signing,
  `Address.fromCashAddress` para address eCash, `Ecc` para ECDSA/Schnorr bajo
  WASM.
- Compatibilidad: soporta eCash message signing directamente; usa prefijo
  `eCash Signed Message`, firma ECDSA recuperable base64 y validacion contra
  address eCash.
- Encaje: mejor opcion para TonalliAuth si Tonalli Wallet firma mensajes eCash.

### `ecashaddrjs`

- Version observada: `2.0.0`.
- Mantenimiento: paquete de Bitcoin ABC, modificado en npm el 2024-12-20.
- API probable: `decodeCashAddress`, `encodeCashAddress`,
  `isValidCashAddress`, `getOutputScriptFromAddress`.
- Compatibilidad: valida y decodifica addresses eCash, pero no verifica firmas.
- Encaje: util como helper de address si se implementa verificacion manual, pero
  insuficiente por si solo.

### `bitcoinjs-message`

- Version observada: `2.2.0`.
- Mantenimiento: paquete publicado/modificado en npm el 2025-06-27.
- API probable: `verify(message, address, signature, messagePrefix?)`.
- Compatibilidad: verifica Bitcoin message signing con firma base64 recuperable.
  Podria adaptarse con message prefix eCash, pero no tiene soporte eCash cashaddr
  nativo.
- Encaje: opcion secundaria si `ecash-lib` no funciona en el runtime web/server,
  requiriendo conversion de address o glue adicional.

### `@noble/secp256k1`

- Version observada: `3.1.0`.
- Mantenimiento: activo, modificado en npm el 2026-04-11.
- API probable: `verify`, `recoverPublicKey`, `schnorr.verify`.
- Compatibilidad: primitiva secp256k1 generica; soporta ECDSA, recovery y
  Schnorr, pero no implementa eCash message signing, prefix, varint, sha256d,
  base64 recoverable signature ni cashaddr.
- Encaje: buena base criptografica si se necesita una implementacion manual, pero
  aumenta superficie de errores frente a `ecash-lib`.

## Recomendacion tecnica

Usar `ecash-lib` para el primer wrapper real de TonalliAuth. Es la unica opcion
evaluada que ya conoce eCash, expone verificacion de mensajes contra address
cashaddr y coincide con el formato que Tonalli Wallet deberia producir si esta
alineada con Bitcoin ABC/Cashtab.

El contrato recomendado para Tonalli Wallet es:

- Firmar el string exacto de `formatChallengeForSigning(challenge)`.
- Usar eCash message signing con prefix `"\x16eCash Signed Message:\n"`.
- Devolver `signature` como base64.
- No enviar `publicKey` como requisito de autenticacion.
- En backend, validar `address` y `signature` con `verifyMsg`.

Si la fixture real de Tonalli Wallet no verifica con `ecash-lib.verifyMsg`, no se
debe activar runtime real todavia. En ese caso hay que documentar la diferencia
exacta: prefijo, hash, algoritmo, encoding o canonicalizacion.

## Plan de implementacion en 2 commits

### Commit 1: instalar dependencia y wrapper real

- Instalar `ecash-lib` en `apps/web`.
- Implementar `EcashMessageVerifier.verify` usando `verifyMsg(input.message,
  input.signature, input.address)`.
- Mantener `TonalliMessageVerifier` sin `any`.
- Conservar el bypass de desarrollo solamente bajo `TONALLI_AUTH_DEV_BYPASS=true`.
- Agregar tests unitarios del wrapper con una firma generada por `ecash-lib.signMsg`
  dentro del test o con fixture local no productiva.
- Ejecutar `pnpm test` y `pnpm typecheck`.

### Commit 2: agregar fixture real y activar tests

- Agregar fixture real producida por Tonalli Wallet: `address`, challenge JSON,
  mensaje exacto y `signature`.
- Agregar test que verifique la fixture real con el wrapper productivo.
- Confirmar si se aceptan prefixes de testnet/regtest.
- Cambiar la ruta web para usar el wrapper real por defecto y dejar el bypass
  explicitamente condicionado a entorno de desarrollo.
- Ejecutar `pnpm test` y `pnpm typecheck`.

