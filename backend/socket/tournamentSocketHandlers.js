// Permite "mirar" un torneo en tiempo real (entrar/salir de su sala de socket)
function registerTournamentSocketHandlers(io, socket) {
    socket.on("tournament:watch", ({ tournamentId } = {}) => {
        if (tournamentId) {
            socket.join(`tournament:${tournamentId}`);
        }
    });

    socket.on("tournament:unwatch", ({ tournamentId } = {}) => {
        if (tournamentId) {
            socket.leave(`tournament:${tournamentId}`);
        }
    });
}

module.exports = registerTournamentSocketHandlers;