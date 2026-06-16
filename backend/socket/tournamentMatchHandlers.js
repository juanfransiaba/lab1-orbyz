const {
    getMatchForPlay,
    attachRoomCode,
    markMatchPlaying,
} = require("../services/tournamentsService");
const {
    createRoom,
    getRoom,
    addPlayer,
    removePlayer,
    findRoomByUser,
    serializeRoom,
} = require("./roomManager");
const { startGame } = require("./gameHandlers");

function registerTournamentMatchHandlers(io, socket) {
    const userId = socket.user.user_id;

    socket.on("tournament:playMatch", async ({ tournamentMatchId } = {}, callback) => {
        try {
            if (!tournamentMatchId) {
                return callback?.({ error: "Falta el cruce" });
            }

            // 1. Validar el cruce y que seas uno de los 2 jugadores
            const match = await getMatchForPlay(tournamentMatchId, userId);

            const usernameOf = (id) =>
                Number(id) === Number(match.player1_id)
                    ? match.player1_username
                    : match.player2_username;

            // 2. Conseguir la sala existente del cruce, o crear una nueva taggeada
            let room = match.online_room_code ? getRoom(match.online_room_code) : null;

            // Si estabas en otra sala (casual), salí primero
            const current = findRoomByUser(userId);
            if (current && (!room || current.code !== room.code)) {
                socket.leave(current.code);
                const updated = removePlayer(current.code, userId);
                if (updated) {
                    io.to(updated.code).emit("room:update", serializeRoom(updated));
                }
            }

            if (!room) {
                room = createRoom({
                    mode: match.mode,
                    continent: match.continent,
                    hostUserId: userId,
                    hostUsername: usernameOf(userId),
                    tournament: {
                        tournamentId: match.tournament_id,
                        tournamentMatchId: match.tournament_match_id,
                        player1Id: match.player1_id,
                        player2Id: match.player2_id,
                    },
                });
                await attachRoomCode(match.tournament_match_id, room.code);
            } else if (!room.players.has(userId)) {
                const added = addPlayer(room.code, {
                    userId,
                    username: usernameOf(userId),
                });
                if (added.error) {
                    return callback?.({ error: added.error });
                }
            }

            socket.join(room.code);
            callback?.({ ok: true, room: serializeRoom(room) });
            io.to(room.code).emit("room:update", serializeRoom(room));

            // 3. Si ya están los dos jugadores del cruce -> arranca la partida sola
            const bothIn =
                room.players.has(match.player1_id) &&
                room.players.has(match.player2_id);

            if (bothIn && room.status === "waiting") {
                await markMatchPlaying(match.tournament_match_id);
                await startGame(io, room, { source: "tournament" });
            }
        } catch (error) {
            console.error("Error en tournament:playMatch:", error);
            callback?.({ error: error.message || "Error del servidor" });
        }
    });
}

module.exports = registerTournamentMatchHandlers;
