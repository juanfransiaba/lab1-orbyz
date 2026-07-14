const pool = require("../db");
const { getRoom, addSpectator, removeSpectator } = require("./roomManager");

async function getUsername(userId) {
    const { rows } = await pool.query(
        "SELECT username FROM users WHERE user_id = $1",
        [userId]
    );
    return rows[0]?.username || `user-${userId}`;
}

// Mismo formato que gameHandlers/connectionHandlers; mantener en sync.
function playerProgress(player) {
    return {
        userId: player.userId,
        username: player.username,
        avatar: player.avatar || null,
        correctCount: player.correctCount ?? 0,
        wrongCount: player.wrongCount ?? 0,
        lives: player.lives ?? 0,
        currentIndex: player.currentIndex ?? 0,
        finished: player.finished ?? false,
        correctStreak: player.correctStreak ?? 0,
        powerups: { fiftyFifty: 0, freeze: 0, screamer: 0, ...(player.powerups || {}) },
        powerupsUsed: { fiftyFifty: 0, freeze: 0, screamer: 0, ...(player.powerupsUsed || {}) },
        frozenUntil: player.frozenUntil ?? 0,
        screamerUntil: player.screamerUntil ?? 0,
    };
}

// Estado completo de la partida para el espectador que recién entra
function buildSnapshot(room) {
    return {
        code: room.code,
        mode: room.mode,
        continent: room.continent,
        status: room.status,
        hostUserId: room.hostUserId,
        totalQuestions: room.questions ? room.questions.length : 0,
        matchEndsAt: room.matchEndsAt || null,
        players: Array.from(room.players.values()).map(playerProgress),
        spectatorCount: room.spectators.length,
        messages: room.messages || [],
    };
}

function registerSpectatorHandlers(io, socket) {
    const userId = socket.user.user_id;

    // ── Entrar como espectador ──
    socket.on("spectator:join", async ({ code } = {}, callback) => {
        try {
            if (!code) return callback?.({ error: "Falta el código de sala" });

            const normalizedCode = String(code).trim().toUpperCase();
            const room = getRoom(normalizedCode);
            if (!room) return callback?.({ error: "La sala no existe" });

            const username = await getUsername(userId);
            const result = addSpectator(normalizedCode, {
                userId,
                username,
                socketId: socket.id,
            });
            if (result.error) return callback?.({ error: result.error });

            socket.join(normalizedCode);
            socket.spectating = normalizedCode;      // para el chat y la limpieza
            socket.spectatorUsername = username;

            // Snapshot inicial (estado actual de la partida) solo para este espectador
            callback?.({ ok: true, snapshot: buildSnapshot(room) });

            // Avisar a la sala que hay un espectador más
            io.to(normalizedCode).emit("spectator:update", {
                spectatorCount: room.spectators.length,
            });

            console.log(`Usuario ${userId} espectando la sala ${normalizedCode}`);
        } catch (error) {
            console.error("Error en spectator:join:", error);
            callback?.({ error: "Error del servidor" });
        }
    });

    // ── Dejar de espectar ──
    socket.on("spectator:leave", (payload, callback) => {
        const code = socket.spectating;
        if (!code) return callback?.({ ok: true });

        const room = removeSpectator(code, socket.id);
        socket.leave(code);
        socket.spectating = null;

        if (room) {
            io.to(code).emit("spectator:update", {
                spectatorCount: room.spectators.length,
            });
        }
        callback?.({ ok: true });
        console.log(`Usuario ${userId} dejó de espectar la sala ${code}`);
    });
}

module.exports = registerSpectatorHandlers;
