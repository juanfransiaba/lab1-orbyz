# Setup completo — Notificaciones (Mail + Campanita)

Todo lo que necesitás para dejar andando las notificaciones de "te pasaron en el ranking":
mail al email registrado + campanita in-app en tiempo real.

Aplicá en este orden. Marcá cada paso a medida que lo hacés.

---

## 1. Instalar dependencia

```bash
cd backend && npm install nodemailer
```

(Solo en `backend/`. El front no necesita nada nuevo para esto.)

---

## 2. Tabla en PostgreSQL

```sql
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications(user_id, read, created_at DESC);
```

> La columna `users.score` ya existe y la reusamos para los puntos del ranking. No hay que tocar `users`.

---

## 3. Variables de entorno (`backend/.env`)

Agregá estas dos líneas:

```
MAIL_USER=juanrudolph04@gmail.com
MAIL_APP_PASSWORD=los16caracteres
```

**Cómo conseguir la App Password de Gmail:**
1. Tu cuenta de Google tiene que tener **verificación en 2 pasos** activada (Security → 2-Step Verification).
2. Después: Google Account → Security → **App passwords** → generás una → te da 16 caracteres.
3. Pegala en `MAIL_APP_PASSWORD` **sin espacios**.

> Sin estas variables, la campanita igual funciona (es una fila en la DB); lo único que no sale es el mail.

---

## 4. Archivos NUEVOS

### 4.1 `backend/socket/ioRef.js`

Guarda la instancia de `io` para poder mandar notificaciones desde cualquier lado.

```js
let io = null;

module.exports = {
    setIO(instance) {
        io = instance;
    },
    getIO() {
        return io;
    },
};
```

### 4.2 `backend/utils/mailer.js`

```js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_APP_PASSWORD,
    },
});

// Mail de "te pasaron en el ranking"
async function sendRankingPassedEmail({ to, toUsername, passerUsername, newScore }) {
    if (!process.env.MAIL_USER || !process.env.MAIL_APP_PASSWORD) {
        console.warn("Mailer no configurado (faltan MAIL_USER / MAIL_APP_PASSWORD)");
        return;
    }

    await transporter.sendMail({
        from: `"Geography Game System" <${process.env.MAIL_USER}>`,
        to,
        subject: `${passerUsername} te pasó en el ranking`,
        text:
            `Hola ${toUsername},\n\n` +
            `${passerUsername} te superó en el ranking de amigos (ahora tiene ${newScore} puntos).\n` +
            `¡Entrá a jugar una partida online para recuperar tu puesto!\n\n` +
            `— Geography Game System`,
    });
}

module.exports = { sendRankingPassedEmail };
```

### 4.3 `backend/utils/notifications.js`

```js
const pool = require("../db");
const { getIO } = require("../socket/ioRef");

// Crea una notificación en la DB y la empuja en tiempo real si el usuario está conectado
async function createNotification(userId, type, payload = {}) {
    try {
        const { rows } = await pool.query(
            `INSERT INTO notifications (user_id, type, payload)
             VALUES ($1, $2, $3)
             RETURNING notification_id, user_id, type, payload, read, created_at`,
            [userId, type, JSON.stringify(payload)]
        );
        const notification = rows[0];

        const io = getIO();
        if (io) {
            io.to(`user:${userId}`).emit("notification:new", notification);
        }

        return notification;
    } catch (error) {
        console.error("Error creando notificación:", error);
    }
}

module.exports = { createNotification };
```

### 4.4 `backend/controllers/notificationsController.js`

```js
const pool = require("../db");

// GET /notifications — mis notificaciones (últimas 50)
const getNotifications = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { rows } = await pool.query(
            `SELECT notification_id, type, payload, read, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [userId]
        );
        res.json(rows);
    } catch (error) {
        console.error("Error en getNotifications:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// PUT /notifications/read-all — marcar todas como leídas
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.user_id;
        await pool.query(
            "UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE",
            [userId]
        );
        res.json({ message: "Todas marcadas como leídas" });
    } catch (error) {
        console.error("Error en markAllAsRead:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// PUT /notifications/:id/read — marcar una como leída
const markAsRead = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { id } = req.params;
        const { rows } = await pool.query(
            `UPDATE notifications SET read = TRUE
             WHERE notification_id = $1 AND user_id = $2
             RETURNING notification_id`,
            [id, userId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: "Notificación no encontrada" });
        }
        res.json({ message: "Marcada como leída" });
    } catch (error) {
        console.error("Error en markAsRead:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

module.exports = { getNotifications, markAllAsRead, markAsRead };
```

### 4.5 `backend/routes/notificationsRoutes.js`

```js
const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const {
    getNotifications,
    markAllAsRead,
    markAsRead,
} = require("../controllers/notificationsController");

router.use(verifyToken);

router.get("/", getNotifications);
router.put("/read-all", markAllAsRead);
router.put("/:id/read", markAsRead);

module.exports = router;
```

### 4.6 `backend/scripts/testNotification.js` (para probar)

```js
require("dotenv").config();
const pool = require("../db");
const { sendRankingPassedEmail } = require("../utils/mailer");

const identifier = process.argv[2];             // username o email del que RECIBE
const passerName = process.argv[3] || "Tester"; // nombre del que "lo pasó"

if (!identifier) {
    console.error(
        "Uso: node scripts/testNotification.js <username-o-email-del-que-recibe> [nombreDelQueLoPaso]"
    );
    process.exit(1);
}

(async () => {
    try {
        const { rows } = await pool.query(
            `SELECT user_id, username, email FROM users
             WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)`,
            [identifier.trim()]
        );

        if (rows.length === 0) {
            console.error("No existe ningún usuario con ese username/email");
            process.exit(1);
        }

        const user = rows[0];

        await pool.query(
            `INSERT INTO notifications (user_id, type, payload)
             VALUES ($1, 'ranking_passed', $2)`,
            [user.user_id, JSON.stringify({ passerUsername: passerName, newScore: 999 })]
        );
        console.log(`Notificación creada para ${user.username} (user_id ${user.user_id})`);

        if (user.email) {
            await sendRankingPassedEmail({
                to: user.email,
                toUsername: user.username,
                passerUsername: passerName,
                newScore: 999,
            });
            console.log(`Mail enviado a ${user.email}`);
        } else {
            console.log("El usuario no tiene email cargado, no se mandó mail");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
})();
```

### 4.7 `frontEnd/src/services/NotificationService.js`

```js
import { getSocket } from "./socket";

const API_URL = import.meta.env.VITE_API_URL;

function headers() {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

export async function getNotifications() {
    const res = await fetch(`${API_URL}/notifications`, { headers: headers() });
    if (!res.ok) throw new Error("No se pudieron cargar las notificaciones");
    return res.json();
}

export async function markNotificationRead(id) {
    const res = await fetch(`${API_URL}/notifications/${id}/read`, {
        method: "PUT",
        headers: headers(),
    });
    if (!res.ok) throw new Error("No se pudo marcar como leída");
    return res.json();
}

export async function markAllNotificationsRead() {
    const res = await fetch(`${API_URL}/notifications/read-all`, {
        method: "PUT",
        headers: headers(),
    });
    if (!res.ok) throw new Error("No se pudieron marcar");
    return res.json();
}

// Push en tiempo real (requiere el socket conectado). Devuelve función para desuscribirse.
export function onNewNotification(handler) {
    const s = getSocket();
    s.on("notification:new", handler);
    return () => s.off("notification:new", handler);
}
```

---

## 5. Cambios en archivos EXISTENTES

> ⚠️ Hay DOS `index.js` distintos. Ojo cuál tocás.

### 5.1 `backend/socket/index.js` (el del Socket.IO)

**(a)** Arriba con los require:

```js
const { setIO } = require("./ioRef");
```

**(b)** Justo después de crear `const io = new Server(...)` (después del bloque cors):

```js
    setIO(io);
```

**(c)** Adentro de `io.on("connection", (socket) => {`, al principio:

```js
        // Sala personal para mandarle notificaciones a este usuario donde sea que esté
        socket.join(`user:${socket.user.user_id}`);
```

### 5.2 `backend/index.js` (el del Express / rutas)

**(a)** Con los otros require de rutas:

```js
const notificationsRoutes = require("./routes/notificationsRoutes");
```

**(b)** Con los otros `app.use`:

```js
app.use("/notifications", notificationsRoutes);
```

### 5.3 `backend/socket/matchRepository.js` (archivo COMPLETO y final)

Reemplazalo entero por esto (incluye puntos de ranking + mail + notificación in-app):

```js
const pool = require("../db");
const { sendRankingPassedEmail } = require("../utils/mailer");
const { createNotification } = require("../utils/notifications");

// Resultado de un jugador (win / loss / draw) a partir del game over
function resultFor(player, gameOver) {
    if (gameOver.draw) return "draw";
    return gameOver.winnerUserId === player.userId ? "win" : "loss";
}

// Puntos para el ranking: ganar online = 3, empatar = 1, perder = 0
function pointsForResult(result) {
    if (result === "win") return 3;
    if (result === "draw") return 1;
    return 0;
}

// Avisa (mail + campanita) a los amigos que este usuario acaba de superar en el ranking
async function notifyRankingPassed(passerUserId, passerUsername, oldScore, newScore) {
    if (newScore <= oldScore) return;

    try {
        const { rows } = await pool.query(
            `SELECT u.user_id, u.username, u.email, u.score
             FROM users u
             WHERE u.score >= $2 AND u.score < $3
               AND u.user_id IN (
                   SELECT CASE
                              WHEN f.requester_id = $1 THEN f.addressee_id
                              ELSE f.requester_id
                          END
                   FROM friendships f
                   WHERE f.status = 'accepted'
                     AND (f.requester_id = $1 OR f.addressee_id = $1)
               )`,
            [passerUserId, oldScore, newScore]
        );

        for (const friend of rows) {
            // Notificación in-app (campanita)
            createNotification(friend.user_id, "ranking_passed", {
                passerUserId,
                passerUsername,
                newScore,
            });

            // Mail
            if (friend.email) {
                sendRankingPassedEmail({
                    to: friend.email,
                    toUsername: friend.username,
                    passerUsername,
                    newScore,
                }).catch((e) => console.error("Error mandando mail de ranking:", e));
            }
        }
    } catch (error) {
        console.error("Error en notifyRankingPassed:", error);
    }
}

async function saveMatchResults(room, gameOver) {
    const players = gameOver.players;

    if (players.length !== 2) {
        console.warn(`No se guarda la partida ${room.code}: no tiene 2 jugadores`);
        return;
    }

    const totalRounds = room.questions ? room.questions.length : 0;
    const finishedAt = new Date();
    const startedAt = room.startedAt || finishedAt;

    for (const player of players) {
        const opponent = players.find((p) => p.userId !== player.userId);
        const raw = room.players.get(player.userId) || {};

        const metadata = {
            is_online: true,
            room_code: room.code,
            opponent_user_id: opponent.userId,
            opponent_username: opponent.username,
            result: resultFor(player, gameOver),
            powerups: {
                extra_lives_awarded: raw.extraLivesAwarded ?? 0,
                fifty_fifty_used: raw.powerupsUsed?.fiftyFifty ?? 0,
                freeze_used: raw.powerupsUsed?.freeze ?? 0,
            },
        };

        try {
            await pool.query(
                `INSERT INTO matches
                    (user_id, mode, status, continent, score,
                     correct_count, wrong_count, round_reached, total_rounds,
                     lives_left, metadata, started_at, finished_at, updated_at)
                 VALUES
                    ($1, $2, 'completed', $3, $4,
                     $5, $6, $7, $8,
                     $9, $10, $11, $12, $12)`,
                [
                    player.userId,
                    room.mode,
                    room.continent || null,
                    player.correctCount,
                    player.correctCount,
                    player.wrongCount,
                    player.currentIndex,
                    totalRounds,
                    player.lives,
                    JSON.stringify(metadata),
                    startedAt,
                    finishedAt,
                ]
            );

            // Sumar puntos de ranking + avisar a quien haya superado
            const points = pointsForResult(metadata.result);
            if (points > 0) {
                const upd = await pool.query(
                    "UPDATE users SET score = score + $1 WHERE user_id = $2 RETURNING score",
                    [points, player.userId]
                );
                const newScore = upd.rows[0].score;
                await notifyRankingPassed(
                    player.userId,
                    player.username,
                    newScore - points,
                    newScore
                );
            }
        } catch (error) {
            console.error(
                `Error guardando la partida del usuario ${player.userId}:`,
                error
            );
        }
    }

    console.log(`Partida ${room.code} guardada en matches (2 filas)`);
}

async function saveAbandonedMatch(room, abandonerUserId) {
    const players = Array.from(room.players.values());

    if (players.length !== 2) {
        console.warn(`No se guarda la partida ${room.code}: no tiene 2 jugadores`);
        return;
    }

    const totalRounds = room.questions ? room.questions.length : 0;
    const finishedAt = new Date();
    const startedAt = room.startedAt || finishedAt;

    for (const player of players) {
        const opponent = players.find((p) => p.userId !== player.userId);
        const abandoned = player.userId === abandonerUserId;

        const metadata = {
            is_online: true,
            room_code: room.code,
            opponent_user_id: opponent.userId,
            opponent_username: opponent.username,
            result: abandoned ? "loss" : "win",
            powerups: {
                extra_lives_awarded: player.extraLivesAwarded ?? 0,
                fifty_fifty_used: player.powerupsUsed?.fiftyFifty ?? 0,
                freeze_used: player.powerupsUsed?.freeze ?? 0,
            },
        };

        try {
            await pool.query(
                `INSERT INTO matches
                    (user_id, mode, status, continent, score,
                     correct_count, wrong_count, round_reached, total_rounds,
                     lives_left, metadata, started_at, finished_at, updated_at)
                 VALUES
                    ($1, $2, $3, $4, $5,
                     $6, $7, $8, $9,
                     $10, $11, $12, $13, $13)`,
                [
                    player.userId,
                    room.mode,
                    abandoned ? "abandoned" : "completed",
                    room.continent || null,
                    player.correctCount ?? 0,
                    player.correctCount ?? 0,
                    player.wrongCount ?? 0,
                    player.currentIndex ?? 0,
                    totalRounds,
                    player.lives ?? 0,
                    JSON.stringify(metadata),
                    startedAt,
                    finishedAt,
                ]
            );

            // El que no abandonó gana -> +3; el que abandonó, 0
            const points = pointsForResult(metadata.result);
            if (points > 0) {
                const upd = await pool.query(
                    "UPDATE users SET score = score + $1 WHERE user_id = $2 RETURNING score",
                    [points, player.userId]
                );
                const newScore = upd.rows[0].score;
                await notifyRankingPassed(
                    player.userId,
                    player.username,
                    newScore - points,
                    newScore
                );
            }
        } catch (error) {
            console.error(
                `Error guardando partida (abandono) del usuario ${player.userId}:`,
                error
            );
        }
    }

    console.log(`Partida ${room.code} guardada (abandono) en matches`);
}

module.exports = { saveMatchResults, saveAbandonedMatch };
```

---

## 6. Probarlo

```bash
cd backend
node scripts/testNotification.js juanrudolph04@gmail.com Pepe
```

- **Campanita**: pegale `GET /notifications` con el token de ese usuario (Postman) → tiene que aparecer la notificación.
- **Mail**: revisá la casilla (y spam). Solo llega si el email es una casilla real que controlás.

> El script crea la notificación directo en la DB, así que el push en tiempo real por socket NO se dispara desde el script (eso pasa solo cuando nace dentro del server corriendo, ej. jugando una partida donde alguien pasa a otro en el ranking).

---

## 7. Checklist de archivos

**Nuevos (7):**
- `backend/socket/ioRef.js`
- `backend/utils/mailer.js`
- `backend/utils/notifications.js`
- `backend/controllers/notificationsController.js`
- `backend/routes/notificationsRoutes.js`
- `backend/scripts/testNotification.js`
- `frontEnd/src/services/NotificationService.js`

**Modificados (3):**
- `backend/socket/index.js` (setIO + sala personal)
- `backend/index.js` (montar ruta `/notifications`)
- `backend/socket/matchRepository.js` (reemplazo completo)

**Otros:**
- `npm install nodemailer`
- tabla `notifications`
- 2 vars en `.env`

---

## Para tu amigo (la campanita en el front)

- Endpoints (con token): `GET /notifications`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`.
- Cada notificación: `{ notification_id, type, payload, read, created_at }`. Hoy `type: "ranking_passed"`, `payload: { passerUsername, newScore, passerUserId }`. Texto: **"{passerUsername} te pasó en el ranking"**.
- Badge = cantidad con `read: false`.
- Tiempo real: `onNewNotification(cb)` (necesita el socket conectado → conviene conectarlo al loguearse para que la campanita ande en cualquier pantalla).
- Va en la sala de amigos / ranking.
