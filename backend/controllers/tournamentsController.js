const tournamentsService = require("../services/tournamentsService");
const { getIO } = require("../socket/ioRef");

function handleError(res, error, label) {
    if (error instanceof tournamentsService.ServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(`Error en ${label}:`, error);
    return res.status(500).json({ message: "Error del servidor" });
}

// Avisa en tiempo real a todos los que están mirando ese torneo
function notifyTournament(tournamentId, event = "tournament:updated") {
    const io = getIO();
    if (io && tournamentId) {
        io.to(`tournament:${tournamentId}`).emit(event, { tournamentId });
    }
}

const listTournaments = async (req, res) => {
    try {
        const tournaments = await tournamentsService.listTournaments({
            status: req.query.status,
            viewerId: req.user.user_id,
        });
        res.json(tournaments);
    } catch (error) {
        handleError(res, error, "listTournaments");
    }
};

const getTournamentById = async (req, res) => {
    try {
        const snapshot = await tournamentsService.getTournamentSnapshot(
            req.params.tournamentId,
            req.user.user_id
        );
        res.json(snapshot);
    } catch (error) {
        handleError(res, error, "getTournamentById");
    }
};

const createTournament = async (req, res) => {
    try {
        const snapshot = await tournamentsService.createTournament(
            req.body,
            req.user.user_id
        );
        res.status(201).json(snapshot);
    } catch (error) {
        handleError(res, error, "createTournament");
    }
};

const updateTournament = async (req, res) => {
    try {
        const snapshot = await tournamentsService.updateTournament(
            req.params.tournamentId,
            req.body,
            req.user.user_id
        );
        notifyTournament(req.params.tournamentId);
        res.json(snapshot);
    } catch (error) {
        handleError(res, error, "updateTournament");
    }
};

const deleteTournament = async (req, res) => {
    try {
        const result = await tournamentsService.deleteTournament(
            req.params.tournamentId,
            req.user.user_id
        );
        notifyTournament(req.params.tournamentId, "tournament:deleted");
        res.json(result);
    } catch (error) {
        handleError(res, error, "deleteTournament");
    }
};

const joinTournament = async (req, res) => {
    try {
        const snapshot = await tournamentsService.joinTournament(
            req.params.tournamentId,
            req.user.user_id
        );
        notifyTournament(req.params.tournamentId);
        res.json(snapshot);
    } catch (error) {
        handleError(res, error, "joinTournament");
    }
};

const joinTournamentByCode = async (req, res) => {
    try {
        const snapshot = await tournamentsService.joinTournamentByCode(
            req.body.code,
            req.user.user_id
        );
        notifyTournament(snapshot?.tournament?.tournament_id);
        res.json(snapshot);
    } catch (error) {
        handleError(res, error, "joinTournamentByCode");
    }
};

const leaveTournament = async (req, res) => {
    try {
        const snapshot = await tournamentsService.leaveTournament(
            req.params.tournamentId,
            req.user.user_id
        );
        notifyTournament(req.params.tournamentId);
        res.json(snapshot);
    } catch (error) {
        handleError(res, error, "leaveTournament");
    }
};

const startTournament = async (req, res) => {
    try {
        const snapshot = await tournamentsService.startTournament(
            req.params.tournamentId,
            req.user.user_id
        );
        notifyTournament(req.params.tournamentId);
        res.json(snapshot);
    } catch (error) {
        handleError(res, error, "startTournament");
    }
};

const setMatchResult = async (req, res) => {
    try {
        const snapshot = await tournamentsService.setMatchResult(
            req.params.tournamentId,
            req.params.matchId,
            req.body.winner_user_id ?? req.body.winnerUserId,
            req.user.user_id
        );
        notifyTournament(req.params.tournamentId);
        res.json(snapshot);
    } catch (error) {
        handleError(res, error, "setMatchResult");
    }
};

const kickParticipant = async (req, res) => {
    try {
        const targetUserId = req.params.userId;

        const snapshot = await tournamentsService.kickParticipant(
            req.params.tournamentId,
            targetUserId,
            req.user.user_id
        );

        notifyTournament(req.params.tournamentId);

        // Avisarle al expulsado (está mirando el torneo) para que lo saque de la pantalla
        const io = getIO();
        if (io) {
            io.to(`tournament:${req.params.tournamentId}`).emit("tournament:kicked", {
                tournamentId: Number(req.params.tournamentId),
                userId: Number(targetUserId),
            });
        }

        res.json(snapshot);
    } catch (error) {
        handleError(res, error, "kickParticipant");
    }
};

module.exports = {
    listTournaments,
    getTournamentById,
    createTournament,
    updateTournament,
    deleteTournament,
    joinTournament,
    joinTournamentByCode,
    leaveTournament,
    startTournament,
    setMatchResult,
    kickParticipant,
};