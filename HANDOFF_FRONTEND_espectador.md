# Handoff Frontend — Modo Espectador

> **Para quién:** el que arma la UI del frontend.
> **Qué es esto:** te cuento **qué se implementó del lado del server** y **qué necesitás manejar vos en el front**. No te digo cómo diseñar la UI — eso es tuyo. Solo el "qué".
> Todo es **server-authoritative**: el server manda los datos, el front solo los muestra.

---

## 1. Qué es el modo espectador

Un **tercero** puede entrar con el código de una partida en curso y verla **en tiempo real**, como observador. Las partidas siguen siendo **de a 2 jugadores**; el espectador no juega, solo mira (y puede chatear). Pueden haber varios espectadores (tope 10 por sala).

El espectador ve un **mostrador (scoreboard)** read-only de los dos jugadores: cantidad de correctas, errores, vidas, power-ups usados, y el timer de la partida. Cada vez que un jugador hace algo (responde, usa un power-up, lo congelan), al espectador se le actualiza solo.

---

## 2. Cómo entra un espectador

Hay un evento dedicado: **`spectator:join { code }`**. El server responde con un **snapshot** del estado actual de la partida (para pintar la pantalla inicial), y a partir de ahí llegan los updates en vivo.

**Flujo de entrada sugerido (UX):** cuando alguien mete un código en "Unirse", probás primero `room:join`. Si el server responde **"La partida ya empezó"** o **"La sala está llena"**, le ofrecés *"¿Verla como espectador?"* → ahí disparás `spectator:join`. Así un mismo código sirve para jugar o para mirar, según el estado de la sala.

Para salir: **`spectator:leave`**.

---

## 3. Lo que necesitás manejar (resumen)

1. **Unirse como espectador** con el código y pintar el estado inicial con el **snapshot**.
2. **Mostrar el scoreboard de los 2 jugadores** y mantenerlo actualizado con los eventos en vivo: correctas, errores, vidas, power-ups usados, en qué pregunta va cada uno.
3. **Timer de la partida** (countdown).
4. **Reflejar los power-ups**: cuando alguien gana vida extra, usa 50/50 o congela al rival, que se vea.
5. **Cantidad de espectadores** (la reciben jugadores y espectadores).
6. **Chat**: el espectador puede escribir y los jugadores (y otros espectadores) lo ven. Los mensajes de espectador vienen marcados para que los distingas.
7. **Fin de partida**: mostrar el resultado.
8. **Salir** (dejar de espectar).

> **Importante:** el espectador es **read-only del juego**. No tiene que poder responder ni usar power-ups (el server ya lo bloquea). Lo único que puede hacer además de mirar es chatear.

---

## 4. Servicios ya provistos (los podés usar tal cual)

- **`frontEnd/src/services/socket.js`** — la conexión Socket.IO (singleton con el JWT). Conectás con `connectSocket()` al entrar al modo online.
- **`frontEnd/src/services/OnlineSpectatorService.js`** — para el espectador:
  - `joinAsSpectator(code)` → devuelve el snapshot inicial.
  - `leaveSpectator()`.
  - `onProgress`, `onPowerupAwarded`, `onPlayerFrozen`, `onGameOver`, `onGameAbandoned`, `onSpectatorUpdate` → cada uno te suscribe a un evento y devuelve una función para desuscribirte.
- **`frontEnd/src/services/OnlineChatService.js`** — para el chat: `sendChatMessage(text)` y `onChatMessage(handler)`. **Ya funciona para espectadores** sin cambios.

Flujo: `connectSocket()` → `joinAsSpectator(code)` (pintás el snapshot) → te suscribís a los eventos para los updates en vivo → al salir, `leaveSpectator()` y desuscribirte.

---

## 5. Contrato de datos (lo que tenés que conocer)

### Snapshot inicial (lo que devuelve `joinAsSpectator`)

```js
{
  code, mode, continent, status,   // status: "waiting" | "playing" | "finished"
  hostUserId,
  totalQuestions,
  matchEndsAt,                      // timestamp absoluto (ms) para el countdown
  players: [ playerProgress, ... ], // los 2 jugadores
  spectatorCount,
  messages: [ ... ]                 // historial de chat
}
```

### `playerProgress` (un jugador) — viene en el snapshot y en `game:progress`

```js
{
  userId, username,
  correctCount,                    // correctas
  wrongCount,                      // errores
  lives,                           // vidas
  currentIndex,                    // en qué pregunta va
  finished,                        // si ya terminó su parte
  correctStreak,                   // racha de correctas
  powerups:     { fiftyFifty, freeze },   // power-ups que le QUEDAN
  powerupsUsed: { fiftyFifty, freeze },   // power-ups USADOS  <-- para el mostrador
  frozenUntil                      // timestamp hasta el que está congelado (0 si no)
}
```

### Eventos en vivo que escucha el espectador

| Evento | Cuándo / qué trae |
|---|---|
| `game:progress` | un `playerProgress` — cada vez que un jugador responde o usa un power-up |
| `powerup:awarded` | `{ userId, type: "extra_life", lives }` — alguien ganó vida extra |
| `player:frozen` | `{ userId, by, frozenUntil, durationMs }` — `userId` quedó congelado |
| `spectator:update` | `{ spectatorCount }` — cambió la cantidad de espectadores |
| `chat:message` | `{ userId, username, text, at, role }` — nuevo mensaje |
| `game:over` | `{ players, winnerUserId, draw }` — fin normal (`winnerUserId` null si empate) |
| `game:abandoned` | `{ abandonerUserId, players }` — un jugador abandonó |

### Chat

- **Mandar:** `sendChatMessage(text)`. Errores posibles del server: mensaje vacío, máximo 500 caracteres, "muy rápido" (rate limit) — mostralos.
- **Recibir:** `chat:message { userId, username, text, at, role }`. El campo **`role`** es `"player"` o `"spectator"`: usalo para mostrar distinto los mensajes de espectadores.

---

## 6. Notas de seguridad

- El espectador **nunca recibe las respuestas correctas** (no se hacen broadcast), así que no hay riesgo de filtración.
- El **`username` lo pone el server** (no el cliente), tanto en el chat como en el scoreboard.
- ⚠️ **Chat / XSS:** renderizá el texto del chat con el escapado por defecto de tu framework (mostrarlo como texto plano). No lo insertes como HTML crudo.

---

## 7. Eventos nuevos (solo del modo espectador), de referencia

**Cliente → Server:**
- `spectator:join { code }` → callback `{ ok, snapshot }` o `{ error }`.
- `spectator:leave` → callback `{ ok }`.

**Server → Cliente:**
- `spectator:update { spectatorCount }`.

Todo lo demás (progreso, power-ups, freeze, chat, game over) **reusa los eventos que ya existían** — el espectador simplemente los escucha igual que un jugador.

---

**Resumen de tu tarea:** una pantalla read-only que, con el snapshot inicial y los eventos en vivo, muestre el mostrador de los 2 jugadores (correctas, errores, vidas, power-ups usados), el timer y la cantidad de espectadores, refleje los power-ups cuando pasan, y tenga un chat donde el espectador puede escribir (distinguiendo sus mensajes con `role`). La lógica y validación ya están en el server.
