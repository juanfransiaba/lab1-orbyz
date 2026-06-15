const pool = require("../db");
const {
    createRoom,
    getRoom,
    addPlayer,
    removePlayer,
    findRoomByUser,
    serializeRoom,
} = require("./roomManager");
const { startGame } = require("./gameHandlers");

const VALID_MODES = [
    "country-by-capital",
    "capital-by-country",
    "country-by-shape",
    "country-by-continent",
    "country-by-map",
];

async function getUsername(userId) {
    const { rows } = await pool.query(
        "SELECT username FROM users WHERE user_id = $1",
        [userId]
    );
    return rows[0]?.username || `user-${userId}`;
}

// Saca al usuario de su sala actual (si tiene una) y avisa a los que quedan
function leaveCurrentRoom(io, socket, userId) {
    const current = findRoomByUser(userId);
    if (!current) return;

    socket.leave(current.code);
    const updated = removePlayer(current.code, userId);

    if (updated) {
        io.to(updated.code).emit("room:update", serializeRoom(updated));
    }
}

function registerLobbyHandlers(io, socket) {
    const userId = socket.user.user_id;

    // ── Crear sala ──
    socket.on("room:create", async ({ mode, continent } = {}, callback) => {
        try {
            if (!VALID_MODES.includes(mode)) {
                return callback?.({ error: "Modo de juego inválido" });
            }
            if (mode === "country-by-continent" && !continent) {
                return callback?.({ error: "Falta el continente" });
            }

            // Si ya estaba en otra sala, salir primero
            leaveCurrentRoom(io, socket, userId);

            const username = await getUsername(userId);
            const room = createRoom({
                mode,
                continent,
                hostUserId: userId,
                hostUsername: username,
            });

            socket.join(room.code);
            callback?.({ room: serializeRoom(room) });

            console.log(`Sala creada: ${room.code} por usuario ${userId}`);
        } catch (error) {
            console.error("Error en room:create:", error);
            callback?.({ error: "Error del servidor" });
        }
    });

    // ── Unirse a una sala ──
    socket.on("room:join", async ({ code } = {}, callback) => {
        try {
            if (!code) {
                return callback?.({ error: "Falta el código de sala" });
            }

            const normalizedCode = String(code).trim().toUpperCase();

            // Las salas de torneo solo se entran desde el bracket, no por código
            const existingRoom = getRoom(normalizedCode);
            if (existingRoom && existingRoom.tournament) {
                return callback?.({
                    error: "Esa sala es de un torneo, entrá desde el cuadro del torneo",
                });
            }

            // Si ya estaba en otra sala distinta, salir primero
            const current = findRoomByUser(userId);
            if (current && current.code !== normalizedCode) {
                leaveCurrentRoom(io, socket, userId);
            }

            const username = await getUsername(userId);
            const result = addPlayer(normalizedCode, { userId, username });

            if (result.error) {
                return callback?.({ error: result.error });
            }

            socket.join(normalizedCode);
            callback?.({ room: serializeRoom(result.room) });

            // Avisar a todos los de la sala (incluido el que entró)
            io.to(normalizedCode).emit("room:update", serializeRoom(result.room));

            console.log(`Usuario ${userId} se unió a la sala ${normalizedCode}`);

            // Auto-arrancar la partida cuando se completa la sala (2 jugadores)
            if (result.room.players.size === 2 && result.room.status === "waiting") {
                await startGame(io, result.room);
            }
        } catch (error) {
            console.error("Error en room:join:", error);
            callback?.({ error: "Error del servidor" });
        }
    });

    // ── Salir de la sala ──
    socket.on("room:leave", (payload, callback) => {
        leaveCurrentRoom(io, socket, userId);
        callback?.({ ok: true });
        console.log(`Usuario ${userId} salió de su sala`);
    });
}

module.exports = registerLobbyHandlers;