const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const { getFriendsRanking } = require("../controllers/rankingController");

router.use(verifyToken);

router.get("/friends", getFriendsRanking);

module.exports = router;