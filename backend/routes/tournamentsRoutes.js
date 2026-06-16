const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const {
    getTournamentById,
    getCurrentTournament,
    createTournament,
    updateTournament,
    deleteTournament,
    joinTournament,
    joinTournamentByCode,
    leaveTournament,
    startTournament,
    kickParticipant,

} = require("../controllers/tournamentsController");

router.use(verifyToken);

router.post("/", createTournament);
router.post("/join-code", joinTournamentByCode);
router.get("/current", getCurrentTournament);
router.get("/:tournamentId", getTournamentById);
router.put("/:tournamentId", updateTournament);
router.delete("/:tournamentId", deleteTournament);
router.post("/:tournamentId/join", joinTournament);
router.post("/:tournamentId/leave", leaveTournament);
router.post("/:tournamentId/start", startTournament);
router.delete("/:tournamentId/participants/:userId", kickParticipant);

module.exports = router;
