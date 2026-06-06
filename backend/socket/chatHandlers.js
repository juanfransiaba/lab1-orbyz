const { findRoomByUser } = require("./roomManager");

const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_MAX = 5;          // máx. mensajes
const RATE_LIMIT_WINDOW_MS = 5000; // por ventana de 5s

function registerChatHandlers(io, socket) {
    const userId = socket.user.user_id;

    // timestamps de los últimos mensajes de este socket (para el rate limit)
    socket.chatTimestamps = [];

    socket.on("chat:message", (payload, callback) => {
        try {
            const room = findRoomByUser(userId);
            if (!room) {
                return callback?.({ error: "No estás en ninguna sala" });
            }

            // ── Validación del texto ──
            let text = payload?.text;
            if (typeof text !== "string") {
                return callback?.({ error: "Mensaje inválido" });
            }
            text = text.trim();
            if (!text) {
                return callback?.({ error: "El mensaje está vacío" });
            }
            if (text.length > MAX_MESSAGE_LENGTH) {
                return callback?.({ error: `Máximo ${MAX_MESSAGE_LENGTH} caracteres` });
            }

            // ── Rate limit ──
            const now = Date.now();
            socket.chatTimestamps = socket.chatTimestamps.filter(
                (t) => now - t < RATE_LIMIT_WINDOW_MS
            );
            if (socket.chatTimestamps.length >= RATE_LIMIT_MAX) {
                return callback?.({ error: "Estás enviando mensajes muy rápido" });
            }
            socket.chatTimestamps.push(now);

            // username viene de la sala (del JWT), NO del cliente -> anti-spoof
            const player = room.players.get(userId);
            const username = player?.username || "Jugador";

            const message = { userId, username, text, at: now };

            // Historial en memoria (para reconexión); se cap a 50
            if (!room.messages) room.messages = [];
            room.messages.push(message);
            if (room.messages.length > 50) room.messages.shift();

            // Broadcast a toda la sala -> los 2 lo reciben al mismo tiempo
            io.to(room.code).emit("chat:message", message);

            callback?.({ ok: true });
        } catch (error) {
            console.error("Error en chat:message:", error);
            callback?.({ error: "Error del servidor" });
        }
    });
}

module.exports = registerChatHandlers;