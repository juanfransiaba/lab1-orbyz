# Handoff Frontend — Integración Torneo ↔ Partidas Online

> **Para quién:** el que arma la UI del frontend.
> **Qué es esto:** el backend ya conecta los cruces del torneo con partidas online reales.
> Te resumo qué cambió y **qué te toca a vos** en el front. La lógica está toda en el server.

---

## Qué cambió (resumen)

Antes: el torneo armaba la llave, pero los cruces **no se jugaban** — el creador apretaba "Gana" a mano.

Ahora: cada cruce se juega como una **partida online de verdad** (la 1v1 que ya existe, con power-ups, chat, espectadores y todo), y **cuando termina, la llave avanza sola**: marca el ganador, elimina al perdedor, arma el cruce siguiente, y si era la final corona al campeón. El botón manual "Gana" ya no hace falta (queda como respaldo, pero se bloquea solo una vez que el cruce se jugó).

Todo esto es backend (ya pusheado). **No hay tablas nuevas** para la integración (se reusa el campo `online_room_code` que ya estaba en `tournament_matches`). Vos solo hacé `git pull` y `npm install` por las dudas.

---

## Lo que tenés que hacer en el front

### 1. Botón "Jugar mi partida" en cada cruce

En el cuadro del torneo, en cada cruce mostrá el botón **"Jugar mi partida"** cuando:

- el cruce tiene `status: "ready"` (los dos jugadores están definidos), **y**
- el usuario logueado es `player1_id` o `player2_id` de ese cruce.

Al apretarlo, por socket:

```js
socket.emit("tournament:playMatch", { tournamentMatchId }, (res) => {
    if (res.error) { /* mostrar error */ }
    else { /* res.room -> ir a la pantalla de partida */ }
});
```

(El `tournamentMatchId` es el `tournament_match_id` de ese cruce, que ya viene en el snapshot del torneo.)

### 2. Ir a la pantalla de partida online

Con el `ok`, llevá al jugador a la **misma pantalla de partida online que ya existe** (la del 1v1). No hay que hacer una nueva: un cruce de torneo ES una partida 1v1 normal por debajo, con los mismos eventos (`game:started`, `game:answer`, `game:progress`, power-ups, chat, etc.).

**Importante:** la partida **arranca sola** cuando entran los dos jugadores (llega `game:started`). **No** hay botón de "empezar" ni "host" — apenas los dos apretaron "Jugar mi partida", el server la arranca.

### 3. Al terminar, volver al cuadro y refrescar

Cuando la partida termina, además del `game:over` (o `game:abandoned`) de siempre, llega un evento nuevo:

```
tournament:matchEnded { tournamentId }
```

Ahí: **volvé al cuadro del torneo y volvé a pedir el snapshot** (el `GET` del torneo que ya usás). El ganador ya avanzó solo en la llave, así que al refetchear vas a ver el bracket actualizado (perdedor eliminado, siguiente cruce armado, o campeón si era la final).

### 4. El socket tiene que estar conectado

Igual que para el chat y el espectador: `connectSocket()` (conviene al loguearse, así anda en cualquier pantalla).

---

## Contrato de eventos (lo nuevo del torneo)

**Cliente → Server:**

| Evento | Payload | Callback |
|---|---|---|
| `tournament:playMatch` | `{ tournamentMatchId }` | `{ ok, room }` o `{ error }` |

**Server → Cliente:**

| Evento | Payload | Cuándo |
|---|---|---|
| `tournament:matchEnded` | `{ tournamentId }` | cuando terminó la partida del cruce y la llave ya avanzó |

Todo lo demás (la partida en sí) usa los eventos online que **ya conocés**: `game:started`, `game:answer`, `game:progress`, `game:over`, `game:abandoned`, power-ups, chat. No cambian.

---

## Errores que puede devolver `tournament:playMatch`

Mostralos al usuario si vienen en `res.error`:

- "No sos jugador de este cruce" (intentó jugar un cruce ajeno).
- "Este cruce todavía no está listo para jugarse" (status no es `ready`/`playing`).
- "El torneo no está activo".
- "Falta el cruce".

---

## Notas

- El botón manual **"Gana"** del creador sigue existiendo como respaldo, pero una vez que un cruce se jugó online queda bloqueado (el cruce ya está `finished`). Podés ocultarlo cuando el cruce ya tiene ganador.
- Si un jugador **abandona/se desconecta** la partida del cruce, el rival gana automáticamente y la llave avanza igual (te llega `tournament:matchEnded`).
- Si la partida del cruce **empata** (raro, solo por tiempo agotado con iguales aciertos), el server desempata solo y igual avanza un ganador.
- Las partidas de torneo también **suman al ranking** (+3 al ganar) y disparan las notificaciones, porque pasan por el mismo guardado que las online normales.

---

**Resumen de tu tarea:** botón "Jugar mi partida" en los cruces `ready` del usuario → `tournament:playMatch` → pantalla de partida online existente → al terminar (`tournament:matchEnded`) volver al cuadro y refetchear. Nada de lógica nueva de juego: reusás todo lo online que ya está.
