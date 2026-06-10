const {
    findRoomByUser,
    removePlayer,
    deleteRoom,
    serializeRoom,
    removeSpectator,
} = require("./roomManager");
const { saveAbandonedMatch } = require("./matchRepository");
const { advanceTournamentMatch } = require("../services/tournamentsService");

// Tiempo para reconectarse antes de que cuente como abandono.
const GRACE_PERIOD_MS = Number(process.env.GRACE_PERIOD_MS) || 30000;

// Helpers (espejo de los de gameHandlers; mantener iguales si cambian allá)
function publicQuestion(question) {
    if (!question) return null;
    return {
        index: question.index,
        prompt: question.prompt,
        imageSrc: question.imageSrc,
        imageAlt: question.imageAlt,
        options: question.options,
    };
}

function playerProgress(player) {
    return {
        userId: player.userId,
        username: player.username,
        correctCount: player.correctCount ?? 0,
        wrongCount: player.wrongCount ?? 0,
        lives: player.lives ?? 0,
        currentIndex: player.currentIndex ?? 0,
        finished: player.finished ?? false,
        correctStreak: player.correctStreak ?? 0,
        powerups: player.powerups ?? { fiftyFifty: 0, freeze: 0 },
        powerupsUsed: player.powerupsUsed ?? { fiftyFifty: 0, freeze: 0 },
        frozenUntil: player.frozenUntil ?? 0,
    };
}

// Termina la partida por abandono de un jugador
function endMatchByAbandon(io, room, abandonerUserId) {
    if (room.status !== "playing") {
        return; // ya había terminado por otro lado
    }

    room.status = "finished";

    if (room.matchTimer) {
        clearTimeout(room.matchTimer);
        room.matchTimer = null;
    }

    io.to(room.code).emit("game:abandoned", {
        abandonerUserId,
        players: Array.from(room.players.values()).map(playerProgress),
    });

    saveAbandonedMatch(room, abandonerUserId).catch((error) =>
        console.error("Error al guardar la partida abandonada:", error)
    );

    // Si era de un torneo, gana el que NO abandonó y avanza la llave
    if (room.tournament) {
        const winner = Array.from(room.players.values())
            .map((p) => p.userId)
            .find((id) => Number(id) !== Number(abandonerUserId));
        if (winner) {
            advanceTournamentMatch(room.tournament.tournamentMatchId, winner)
                .then(() => {
                    io.to(room.code).emit("tournament:matchEnded", {
                        tournamentId: room.tournament.tournamentId,
                    });
                })
                .catch((e) =>
                    console.error("Error avanzando torneo (abandono):", e)
                );
        }
    }

    deleteRoom(room.code);

    console.log(
        `Partida ${room.code} terminada por abandono del usuario ${abandonerUserId}`
    );
}

function handleConnection(io, socket) {
    const userId = socket.user.user_id;

    // ── Reconexión: ¿el usuario estaba en una partida en curso? ──
    const room = findRoomByUser(userId);

    if (room && room.status === "playing") {
        const player = room.players.get(userId);

        if (player && player.connected === false) {
            // Cancelar el timer de abandono
            if (player.disconnectTimer) {
                clearTimeout(player.disconnectTimer);
                player.disconnectTimer = null;
            }

            player.connected = true;
            socket.join(room.code);

            const currentQuestion = player.finished
                ? null
                : publicQuestion(room.questions[player.currentIndex]);

            // Mandarle el estado actual de la partida
            socket.emit("game:reconnected", {
                room: serializeRoom(room),
                totalQuestions: room.questions.length,
                question: currentQuestion,
                players: Array.from(room.players.values()).map(playerProgress),
                matchEndsAt: room.matchEndsAt,
                messages: room.messages || [],
            });

            // Avisarle al rival que volvió
            io.to(room.code).emit("player:reconnected", { userId });

            console.log(`Usuario ${userId} se reconectó a la sala ${room.code}`);
        }
    }

    // ── Desconexión ──
    socket.on("disconnect", () => {
        // Si era espectador, lo sacamos de la sala que miraba
        if (socket.spectating) {
            const specRoom = removeSpectator(socket.spectating, socket.id);
            if (specRoom) {
                io.to(socket.spectating).emit("spectator:update", {
                    spectatorCount: specRoom.spectators.length,
                });
            }
            socket.spectating = null;
        }

        const current = findRoomByUser(userId);
        if (!current) return;

        // Lobby (partida no empezada): se lo saca normalmente
        if (current.status === "waiting") {
            const updated = removePlayer(current.code, userId);
            if (updated) {
                io.to(updated.code).emit("room:update", serializeRoom(updated));
            }
            console.log(`Usuario ${userId} salió del lobby ${current.code}`);
            return;
        }

        // Partida ya terminada: se lo saca para limpiar
        if (current.status === "finished") {
            removePlayer(current.code, userId);
            return;
        }

        // Partida EN CURSO: no se lo saca, se le da tiempo para volver
        const player = current.players.get(userId);
        if (!player) return;

        player.connected = false;

        io.to(current.code).emit("player:disconnected", {
            userId,
            graceMs: GRACE_PERIOD_MS,
        });

        console.log(
            `Usuario ${userId} se desconectó de la partida ${current.code}; ` +
            `${GRACE_PERIOD_MS / 1000}s para reconectarse`
        );

        player.disconnectTimer = setTimeout(() => {
            const stillRoom = findRoomByUser(userId);
            if (!stillRoom || stillRoom.code !== current.code) return;

            const stillPlayer = stillRoom.players.get(userId);
            if (!stillPlayer || stillPlayer.connected) return;

            // No volvió a tiempo -> abandono
            endMatchByAbandon(io, stillRoom, userId);
        }, GRACE_PERIOD_MS);
    });
}

module.exports = handleConnection;