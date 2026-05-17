const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const {
    createMatch,
    updateMatch,
    getMyMatches,
    getMatchById,
} = require("../controllers/matchesController");

router.use(verifyToken);

router.get("/", getMyMatches);
router.get("/:matchId", getMatchById);
router.post("/", createMatch);
router.put("/:matchId", updateMatch);

module.exports = router;
