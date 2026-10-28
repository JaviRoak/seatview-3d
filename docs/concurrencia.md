# Concurrencia: bloqueo temporal de asientos (issue #8)

## Objetivo
Que sea **imposible** que dos usuarios aparten el mismo asiento, aun con miles de clientes concurrentes, y que un asiento apartado y no pagado vuelva a estar disponible automáticamente. Es la base sobre la que se construye la compra.

## Algoritmo

### 1. Adquirir (`POST /api/locks`)
Clave en Redis: `seat:{eventId}:{eventSeatId}` con valor `userId` y TTL `LOCK_TTL_SECONDS` (300 s por defecto).

El corazón es `SET key userId NX EX ttl`: Redis es de un solo hilo, así que entre N clientes que ejecutan el `SET NX` a la vez **exactamente uno** obtiene `OK`; los demás reciben `nil`. No hay ventana entre "comprobar" y "escribir".

Para aplicar además el límite de asientos por usuario (`MAX_LOCKS_PER_USER`, 6 por defecto) sin condición de carrera, la adquisición completa está en un **script Lua** (`ACQUIRE_LUA` en `locks.service.ts`) que en una sola ejecución atómica:
1. Si la clave ya es del mismo usuario → renueva el TTL (idempotente).
2. Si es de otro → devuelve `0` (la API responde **409 `SEAT_TAKEN`**).
3. Si el set `locks:user:{eventId}:{userId}` ya tiene `MAX` miembros → devuelve `-1` (**409 `LOCK_LIMIT`**).
4. `SET NX EX`; si gana, añade el asiento al set del usuario.

Antes de llamar al script, la ruta comprueba en PostgreSQL que el asiento pertenezca al evento (404) y que no esté vendido (**409 `SEAT_SOLD`**). Cada bloqueo exitoso se difunde a la sala del evento con `seats:update` (estado `LOCKED`, dueño y TTL).

### 2. Liberar y extender (`DELETE /api/locks`, `POST /api/locks/extend`)
Ambos son scripts Lua que primero hacen `GET` y comparan con el `userId` del JWT, y solo entonces `DEL`/`EXPIRE`. Al ser un solo script, nadie puede "colarse" entre la comprobación y la acción: un usuario nunca libera ni extiende el bloqueo de otro (extender un bloqueo ajeno o expirado responde **409 `LOCK_LOST`**).

### 3. Expiración
Cuando el TTL vence, Redis borra la clave; el asiento queda libre automáticamente sin intervención del servidor. Para que los clientes lo vean (< 1 s) hay dos mecanismos:

| Mecanismo | Cómo | Latencia | Requisito | Riesgo |
|---|---|---|---|---|
| **Keyspace notifications** (principal) | Redis publica en `__keyevent@0__:expired`; el backend, suscrito, emite `seats:update` | ≈ TTL + 0–100 ms (medido: 1.06 s con TTL de 1 s) | `notify-keyspace-events Ex` (configurado en `docker-compose.yml` y en el CI) | Las notificaciones son *fire-and-forget*: si el backend se reinicia justo entonces, se pierde |
| **Barrido periódico** (respaldo) | Cada `LOCK_SWEEP_INTERVAL_MS` (5 s) el backend hace `SCAN seat:{eventId}:*`, compara con la foto anterior y emite los que desaparecieron | ≤ 5 s | Ninguno | Coste O(bloqueos vivos) cada 5 s, despreciable |

**Decisión:** con `LOCK_EXPIRY_STRATEGY=keyspace` se activan **ambos**. Las notificaciones dan la latencia exigida (< 1 s) y el barrido garantiza consistencia eventual si una notificación se pierde o si el proveedor de Redis no permite cambiar la configuración (en ese caso `LOCK_EXPIRY_STRATEGY=sweep`). Antes de emitir se comprueba en BD que el asiento no esté `SOLD`: un asiento vendido nunca se anuncia como liberado.

Al recargar la página, el cliente pide `GET /api/locks/:eventId` para recuperar sus bloqueos vivos y su TTL restante; la cuenta regresiva siempre parte del TTL real que informa Redis, nunca de un reloj local.

## Por qué es seguro (resumen)
1. **Una sola escritura atómica** decide el ganador (`SET NX`), sin lectura previa desde la aplicación.
2. **El límite por usuario se aplica dentro del mismo script Lua** que adquiere, así que no se puede superar con solicitudes en paralelo.
3. **Verificación de dueño dentro del mismo script Lua** para liberar/extender.
4. **El cliente no decide nada**: solo pinta lo que el servidor le dice (API + `seats:update`).

## Evidencia (pruebas en `backend/tests/`)
- `locks.test.ts`: bloquear, rechazar segundo bloqueo, renovar, liberar/extender solo por el dueño, límite por usuario, expiración real por TTL.
- `concurrency.test.ts`: **50 solicitudes HTTP simultáneas** al mismo asiento → exactamente 1×201 y 49×409 `SEAT_TAKEN`; ídem 50 llamadas directas al servicio.
- `locksApi.test.ts`: por HTTP, apartar (201), `SEAT_TAKEN`, `SEAT_SOLD`, `LOCK_LIMIT` y liberar solo el dueño.
- `events.test.ts`: el mapa de asientos refleja un bloqueo de Redis como `LOCKED` con su dueño y una venta de PostgreSQL como `SOLD`.

Todas se ejecutan contra **Redis y PostgreSQL reales**, en local y en el CI (`.github/workflows/ci.yml`).

## Cómo reproducirlo a mano con dos navegadores
1. Navegador A: ingresa como `andres.berrios@seatview.test` y abre el evento.
2. Navegador B (ventana privada): ingresa como `javier.polanco@seatview.test` y abre el mismo evento.
3. En A, haz clic en un asiento para sentarte en él y pulsa **Apartar este asiento**: en B se vuelve gris ("en compra por otro") en menos de un segundo.
4. En B, siéntate en ese mismo asiento: el botón queda deshabilitado ("Otra persona lo está comprando ahora").
5. En A, espera a que expire (o baja `LOCK_TTL_SECONDS=20` en `backend/.env`): en ambos vuelve a su color de zona.
