const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const {
    getGlobalRanking,
    getFriendsRanking,
} = require("../controllers/rankingController");

// Requieren estar logueado
router.use(verifyToken);

router.get("/global", getGlobalRanking);
router.get("/friends", getFriendsRanking);

module.exports = router;