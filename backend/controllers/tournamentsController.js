const tournamentsService = require("../services/tournamentsService");

function handleError(res, error, label) {
    if (error instanceof tournamentsService.ServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
    }

    console.error(`Error en ${label}:`, error);
    return res.status(500).json({ message: "Error del servidor" });
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

        res.json(snapshot);
    } catch (error) {
        handleError(res, error, "setMatchResult");
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
};
