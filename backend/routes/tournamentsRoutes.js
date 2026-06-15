const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const {
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

} = require("../controllers/tournamentsController");

router.use(verifyToken);

router.get("/", listTournaments);
router.post("/", createTournament);
router.post("/join-code", joinTournamentByCode);
router.get("/:tournamentId", getTournamentById);
router.put("/:tournamentId", updateTournament);
router.delete("/:tournamentId", deleteTournament);
router.post("/:tournamentId/join", joinTournament);
router.post("/:tournamentId/leave", leaveTournament);
router.post("/:tournamentId/start", startTournament);
router.post("/:tournamentId/matches/:matchId/result", setMatchResult);
router.delete("/:tournamentId/participants/:userId", kickParticipant);

module.exports = router;
