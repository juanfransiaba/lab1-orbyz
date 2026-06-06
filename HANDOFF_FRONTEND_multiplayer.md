# Handoff Frontend — Multiplayer Online (Power-ups + Chat)

> **Para quién es esto:** el que arma la **UI del frontend** (y su IA).
> **Quién escribe:** el backend ya está hecho del lado del servidor. Acá te explico
> qué se implementó, **por qué se hizo así**, y **qué te toca a vos** en el front.
> Todo lo del servidor es **server-authoritative**: el server decide y valida todo,
> el cliente solo muestra y manda intenciones. No calcules nada de lógica de juego
> en el front; confiá en lo que manda el server.

---

## 0. Contexto mínimo del proyecto

- Juego web de geografía tipo quiz. Monorepo: `backend/` (Node + Express + PostgreSQL + **Socket.IO**) y `frontEnd/` (React 19 + Vite + react-router-dom).
- Auth con **JWT** (se guarda en `localStorage` bajo la clave `token`, y se manda como `Authorization: Bearer <token>` en la API REST).
- El **multiplayer online 1v1** corre por **Socket.IO** sobre el mismo server HTTP.
- La API REST (`VITE_API_URL`, por defecto `http://localhost:3000`) ya tiene auth, amigos, países, partidas, etc. El Socket.IO usa esa misma URL.

### Modelo del juego online (importante para la UI)

- **2 jugadores fijos** por sala.
- **No hay rondas sincronizadas**: cada uno juega a su ritmo. Mismo orden de preguntas para los dos (justicia).
- **3 vidas** cada uno. Cada respuesta incorrecta resta 1 vida.
- El server **nunca** manda la respuesta correcta antes de que contestes (anti-trampa). La correcta se revela **solo después** de responder, en la respuesta (callback) del evento.
- **Reconexión**: si te caés a mitad de partida, tenés un período de gracia (default 30s) para volver. Al reconectar te restauran el estado.

---

## 1. Cómo conectarse al Socket.IO (la base)

El front todavía **no tenía** cliente de Socket.IO. Se agregó la dependencia y un módulo singleton de conexión. Si no está instalado:

```bash
cd frontEnd && npm install socket.io-client
```

Archivo de conexión (singleton reusable por todo el multiplayer): **`frontEnd/src/services/socket.js`**

```js
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL;

function getToken() {
    return localStorage.getItem("token");
}

let socket = null;

// Devuelve la instancia del socket (la crea la primera vez, sin conectar todavía)
export function getSocket() {
    if (!socket) {
        socket = io(API_URL, {
            auth: { token: getToken() },
            autoConnect: false,
        });
    }
    return socket;
}

// Conecta (refrescando el token por si hubo re-login)
export function connectSocket() {
    const s = getSocket();
    s.auth = { token: getToken() };
    if (!s.connected) s.connect();
    return s;
}

export function disconnectSocket() {
    if (socket) socket.disconnect();
}
```

**Por qué así:**
- **Singleton**: una sola conexión para toda la sesión. Si abrís y cerrás pantallas, no se crean N sockets.
- **`autoConnect: false`**: el socket no se conecta solo al importar el módulo. Conectás explícitamente con `connectSocket()` cuando el usuario entra al modo online (así no tenés un socket abierto en pantallas donde no lo necesitás).
- **`auth.token`**: el server valida el JWT en el handshake. Si el token es inválido o falta, la conexión se rechaza (`connect_error`). Por eso refrescamos el token en `connectSocket` por si el usuario se re-logueó.

> **Lo que falta construir (tu tarea grande):** el **flujo de conexión + salas** del front no existe todavía. `OnlineMode.jsx` es solo la pantalla con los botones "Crear" / "Unirse", pero los botones no hacen nada. Hay que cablear: conectar el socket al entrar, `room:create` / `room:join`, pantalla de lobby, pantalla de partida, y ahí adentro los power-ups y el chat. Toda la referencia de eventos está en la sección 5.

---

## 2. POWER-UPS — qué se hizo en el backend y por qué

Se implementaron **3 power-ups**, todos en el server (anti-trampa). Tu trabajo es **mostrarlos** y **mandar la intención** cuando el usuario los activa.

### 2.1 Vida extra (automática)

- **Qué hace:** cada **10 respuestas correctas seguidas**, te dan **+1 vida** (con tope de 3). Si ya tenés 3 vidas, la racha se reinicia pero no pasa nada (no se acumulan más de 3).
- **Dónde vive el contador:** en el **server**, en el estado del jugador (`correctStreak`). Vos no lo calculás.
- **Cómo te enterás:**
  - En el callback de `game:answer` viene `correctStreak` (la racha actual) y `extraLife: true` si justo en esa respuesta ganaste una vida.
  - Además el server emite a la sala `powerup:awarded { userId, type: "extra_life", lives }`.
- **Qué hace la UI:** mostrar el contador de racha (ej. "racha: 7/10"), y cuando llega la vida extra, animar el "+1 vida".

**Por qué automática y server-side:** es la opción más simple y la más segura. Si el contador estuviera en el cliente, cualquiera podría falsear su racha. Al vivir en el server y solo *mostrarse* en el cliente, no se puede trampear.

### 2.2 50/50 (descarte)

- **Qué hace:** elimina **2 de las opciones incorrectas** de **tu pregunta actual**, dejándote 2 (la correcta + 1 incorrecta). Empezás con **1 uso** por partida.
- **Cómo se activa:** mandás `game:usePowerup { type: "fifty_fifty" }`. El server responde (callback) con `{ ok, questionIndex, removedIndices: [i, j], powerups }`.
- **Qué hace la UI:** al recibir el callback, **ocultar/deshabilitar** las opciones cuyos índices estén en `removedIndices`, **solo en la pregunta `questionIndex`**.

**Por qué el server elige cuáles sacar:** clave anti-trampa. El server sabe cuál es la correcta; el cliente **no**. Si el cliente eligiera qué opciones quitar, podría deducir la respuesta. El server saca 2 incorrectas al azar y te manda solo los índices a ocultar — **nunca** te dice cuál de las 2 que quedan es la correcta.

### 2.3 Congelar rival (freeze)

- **Qué hace:** congela al **rival** por **10s** (configurable). Mientras está congelado, **el server le rechaza las respuestas**: no puede contestar hasta que pase el tiempo. Empezás con **1 uso** por partida.
- **Cómo se activa:** mandás `game:usePowerup { type: "freeze" }`. Callback `{ ok, frozenUntil, powerups }`.
- **Cómo se entera el rival:** el server emite a la sala `player:frozen { userId, by, frozenUntil, durationMs }`. Si `userId` sos vos, **estás congelado hasta `frozenUntil`** (timestamp absoluto en ms).
- **Qué hace la UI del que fue congelado:** bloquear los botones de respuesta y mostrar una cuenta regresiva hasta `frozenUntil`. Reactivar al terminar.
  - Defensa extra: si el congelado igual intenta responder, el server devuelve `{ error: "Estás congelado", frozenUntil }` en el callback de `game:answer`. La UI puede usar ese `frozenUntil` para sincronizar.

**Por qué tiene sentido el freeze:** la partida tiene un **timer global de 5 minutos** (ver 2.4). Congelar al rival le quema segundos de su reloj. Es un power-up de sabotaje real, no cosmético. Y como lo **enforcea el server** (rechaza las respuestas), no depende de que el cliente "respete" estar congelado.

### 2.4 Timer de partida (5 minutos) y formas de ganar

Se agregó un **reloj global de partida** (5 min por defecto). La partida ahora termina por **lo que pase primero**:

1. **Terminás todas las preguntas estando vivo** → **ganás** (terminar primero).
2. **Te quedás sin vidas** → **gana el rival** (eliminación).
3. **Se cumplen los 5 minutos** → gana el de **más correctas**; si empatan, `draw`.

- El server manda `matchEndsAt` (timestamp absoluto) en `game:started` y en `game:reconnected`.
- **Qué hace la UI:** mostrar una cuenta regresiva calculada con `matchEndsAt` (mm:ss restantes). Es **cosmética**: la verdad la tiene el server, que cierra la partida solo al cumplirse el tiempo.

**Por qué un timer:** sin límite de tiempo, el freeze no tendría costo real para el rival. Con reloj, congelar = robarle tiempo. Además le da ritmo a la partida y una tercera vía de victoria (velocidad).

> **Nota sobre "terminar primero":** para *terminar* la secuencia hay que sobrevivir todas las preguntas (no quedarte sin vidas). En modos globales hay ~195 preguntas (terminar en 5 min es casi imposible → decide vidas o timer); en modos por continente chico (ej. Oceanía) sí se puede terminar y ahí "terminar primero" es la vía real.

### 2.5 ¿Qué te toca a vos en el front para power-ups? (resumen)

Nada de lógica. Solo UI que consume datos que el server ya manda:

1. **Vidas**: mostrar `lives` (corazones) que viene en el callback de `game:answer` y en `game:progress`.
2. **Racha**: mostrar `correctStreak` (ej. progreso X/10 hacia la vida extra).
3. **Vida extra ganada**: animar cuando `extraLife: true` (callback) o llega `powerup:awarded`.
4. **Botón 50/50**: deshabilitado si `powerups.fiftyFifty === 0`. Al click → `emit("game:usePowerup", { type: "fifty_fifty" })`. En el callback, ocultar las opciones de `removedIndices`.
5. **Botón Freeze**: deshabilitado si `powerups.freeze === 0`. Al click → `emit("game:usePowerup", { type: "freeze" })`.
6. **Estar congelado**: al recibir `player:frozen` con tu `userId`, bloquear respuestas y mostrar countdown hasta `frozenUntil`.
7. **Progreso del rival**: pintar el estado del rival desde `game:progress` (sus vidas, correctas, si está congelado, etc.).
8. **Timer**: countdown con `matchEndsAt`.

---

## 3. CHAT EN PARTIDA — qué se hizo en el backend y por qué

Chat de texto en tiempo real entre los 2 jugadores de la sala.

- **Cómo se manda:** `chat:message { text }`. Callback `{ ok }` o `{ error }`.
- **Cómo llega:** el server emite a la sala `chat:message { userId, username, text, at }`. Les llega **a los dos al mismo tiempo** (incluido el que lo mandó, así no tenés que agregarlo a mano: lo agregás cuando vuelve por el evento).
- **Es efímero:** vive en memoria del server (no toca la base de datos). Si el server se reinicia, se pierde.
- **Funciona en lobby y en partida** (cualquiera que esté en la sala).
- **Historial:** el server guarda los últimos 50 mensajes de la sala y los manda en `game:reconnected` (campo `messages`), para que al reconectarte recuperes la conversación.

**Decisiones de diseño (y por qué):**

- **`userId` y `username` los pone el server** (desde el JWT / la sala), **NO** del payload del cliente. Aunque el cliente mande otro nombre, se ignora. → anti-spoof: nadie puede hacerse pasar por otro.
- **Validación**: el texto se trimea, no puede estar vacío, máximo **500 caracteres**.
- **Rate limit**: máximo **5 mensajes cada 5 segundos** por socket. Si te pasás, el callback devuelve error. → evita flood/spam.

### 3.1 Servicio de chat ya provisto

**`frontEnd/src/services/OnlineChatService.js`**

```js
import { getSocket } from "./socket";

// Envía un mensaje al chat de la partida. Promesa con la respuesta del server.
export function sendChatMessage(text) {
    return new Promise((resolve, reject) => {
        const socket = getSocket();
        socket.emit("chat:message", { text }, (res) => {
            if (res?.error) reject(new Error(res.error));
            else resolve(res);
        });
    });
}

// Se suscribe a los mensajes entrantes. Devuelve una función para desuscribirse.
export function onChatMessage(handler) {
    const socket = getSocket();
    socket.on("chat:message", handler);
    return () => socket.off("chat:message", handler);
}
```

### 3.2 ¿Qué te toca a vos en el front para el chat?

1. Un panel con lista de mensajes + input + botón enviar.
2. Al enviar: `sendChatMessage(texto)`; limpiar el input. Manejar el error (ej. "muy rápido" o "máximo 500").
3. Suscribirte una vez (en un `useEffect`) con `onChatMessage(msg => agregarALista(msg))` y desuscribirte al desmontar (la función que devuelve).
4. Distinguir mensajes propios vs del rival comparando `msg.userId` con tu `user_id` (lo sacás del JWT o de donde ya tengas el user logueado).
5. Mostrar el `username` y, si querés, la hora con `msg.at`.
6. (Opcional) Al recibir `game:reconnected`, precargar `messages` en la lista.

> ⚠️ **SEGURIDAD — XSS (importante):** renderizá el texto con el escapado por defecto de React (`{msg.text}`). **NUNCA** uses `dangerouslySetInnerHTML` con el contenido del chat. Así, si alguien manda `<script>...`, se muestra como texto plano y no se ejecuta. El server reenvía el texto crudo a propósito (sanitizar de más rompe mensajes legítimos); el escapado es responsabilidad del render.

---

## 4. Notas de seguridad generales (para que no te rompan nada)

Este proyecto es una entrega de facultad y los profes van a intentar romperlo. Cosas a respetar en el front:

- **No confíes en el cliente para nada de lógica.** El server valida vidas, respuestas, índices, power-ups, freeze, rate limit, etc. La UI solo refleja lo que el server dice.
- **Nunca muestres la respuesta correcta antes de tiempo.** El server no la manda hasta que contestás; no la inventes ni la deduzcas en el front.
- **No mandes `userId`/`username` en los payloads** esperando que el server los use: los toma del JWT.
- **Escapá el chat** (ver arriba).
- **El token va en `auth.token` del socket**, no en query string.

---

## 5. Referencia COMPLETA de eventos Socket.IO

Esto es el **contrato**. Aunque reestructures los servicios, respetá estos nombres y payloads.

### 5.1 Cliente → Server (vos emitís)

| Evento | Payload | Callback (respuesta) |
|---|---|---|
| `room:create` | `{ mode, continent? }` | `{ room }` o `{ error }` |
| `room:join` | `{ code }` | `{ room }` o `{ error }` |
| `room:leave` | — | — |
| `game:start` | `{}` (solo el host) | `{ ok }` o `{ error }` |
| `game:answer` | `{ index, option }` | ver 5.3 |
| `game:usePowerup` | `{ type: "fifty_fifty" \| "freeze" }` | ver 5.4 |
| `chat:message` | `{ text }` | `{ ok }` o `{ error }` |

- `mode`: uno de `"country-by-capital"`, `"capital-by-country"`, `"country-by-shape"`, `"country-by-continent"`.
- `continent`: solo se usa con el modo `"country-by-continent"`.
- `index`: tiene que ser **tu** índice de pregunta actual (`currentIndex`), si no el server lo rechaza.
- `option`: el **valor** de la opción elegida (string), no el índice.

### 5.2 Server → Cliente (vos escuchás)

| Evento | Payload |
|---|---|
| `room:update` | `{ code, mode, continent, hostUserId, status, players: [...], spectatorCount }` |
| `game:started` | `{ totalQuestions, question, matchEndsAt }` |
| `game:progress` | un **playerProgress** (ver 5.5) — el progreso de UN jugador |
| `game:over` | `{ players: [playerProgress], winnerUserId, draw }` |
| `game:reconnected` | `{ room, totalQuestions, question, players: [playerProgress], matchEndsAt, messages }` |
| `game:abandoned` | `{ abandonerUserId, players: [playerProgress] }` |
| `player:disconnected` | `{ userId, graceMs }` |
| `player:reconnected` | `{ userId }` |
| `powerup:awarded` | `{ userId, type: "extra_life", lives }` |
| `player:frozen` | `{ userId, by, frozenUntil, durationMs }` |
| `chat:message` | `{ userId, username, text, at }` |

- `question` (versión pública, **sin** la respuesta): `{ index, prompt, imageSrc, imageAlt, options: [string, ...] }`.
- `winnerUserId`: el `user_id` del ganador, o `null` si es empate (`draw: true`).
- `matchEndsAt` / `frozenUntil`: timestamps absolutos en ms (`Date.now()`-style).

### 5.3 Callback de `game:answer`

```js
{
  correct: boolean,         // si acertaste
  correctValue: string,     // la respuesta correcta (se revela DESPUÉS de contestar)
  lives: number,            // vidas que te quedan
  correctCount: number,
  wrongCount: number,
  correctStreak: number,    // racha actual (para la vida extra cada 10)
  extraLife: boolean,       // true si en esta respuesta ganaste una vida
  finished: boolean,        // true si terminaste tu parte (sin vidas o sin preguntas)
  nextQuestion: question | null  // la próxima pregunta pública, o null si terminaste
}
```

Si estás **congelado** y tratás de responder, en vez de lo de arriba te llega:
`{ error: "Estás congelado", frozenUntil }`.

### 5.4 Callback de `game:usePowerup`

- `fifty_fifty`:
```js
{ ok: true, type: "fifty_fifty", questionIndex: number, removedIndices: [i, j], powerups: { fiftyFifty, freeze } }
```
- `freeze`:
```js
{ ok: true, type: "freeze", frozenUntil: number, powerups: { fiftyFifty, freeze } }
```
- error (sin usos, congelado, etc.): `{ error: "..." }`.

### 5.5 Forma de `playerProgress`

Lo que viene en `game:progress`, y en los arrays `players` de `game:over` / `game:reconnected` / `game:abandoned`:

```js
{
  userId, username,
  correctCount, wrongCount,
  lives,
  currentIndex,
  finished,
  correctStreak,
  powerups: { fiftyFifty, freeze },   // usos restantes
  frozenUntil                          // timestamp hasta el que está congelado (0 si no)
}
```

---

## 6. Flujo recomendado para la pantalla de partida (orientativo)

1. Al entrar al modo online: `connectSocket()`. Escuchar `connect` y `connect_error`.
2. Crear o unirse a sala (`room:create` / `room:join`). Guardar el `code` y mostrar lobby. Escuchar `room:update` para ver quién entra.
3. El host hace `game:start`. Los dos reciben `game:started` → renderizar la primera pregunta y arrancar el countdown con `matchEndsAt`.
4. Por cada pregunta: el usuario elige una opción → `game:answer { index, option }`. Con el callback: actualizar vidas/racha, revelar `correctValue`, y pasar a `nextQuestion` (o terminar si `finished`).
5. Power-ups: botones 50/50 y freeze (deshabilitados según `powerups`). Manejar `player:frozen`, `powerup:awarded`.
6. Progreso del rival: actualizar con cada `game:progress`.
7. Chat: panel con `sendChatMessage` / `onChatMessage`.
8. Fin: `game:over` (mostrar ganador/empate) o `game:abandoned` (el rival abandonó → ganás). Reconexión: `game:reconnected` (restaurar todo el estado, incluido el chat).
9. Al salir: `disconnectSocket()`.

---

## 7. Cómo lo probás vos (front) sin esperar

En el `.env` del **backend** podés bajar los tiempos para testear rápido:

```
MATCH_DURATION_MS=20000     # partida de 20s en vez de 5 min
FREEZE_DURATION_MS=5000     # freeze de 5s en vez de 10
GRACE_PERIOD_MS=5000        # gracia de reconexión de 5s
```

Cuando termines, sacá esas líneas y vuelven los defaults (5 min / 10s / 30s).

---

**Resumen de tu trabajo:** construir la UI del flujo online (conexión, lobby, partida), y dentro de la partida mostrar vidas/racha/timer, los botones de power-ups (50/50 y freeze) con sus efectos, el estado de "congelado", y el panel de chat. **Toda la lógica y validación ya está en el server**; vos consumís los eventos de la sección 5 y pintás. Respetá el contrato de eventos y las notas de seguridad (sobre todo escapar el chat).
