const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");

const {
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    getProfile
} = require("../controllers/userController");

router.get("/profile", verifyToken, getProfile);

router.get("/", getUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

module.exports = router;