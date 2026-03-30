const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");

const {
    getUsers,
    getUserById,
    getProfile,
    updateProfile,
    deleteProfile
} = require("../controllers/userController");


router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfile);
router.delete("/profile", verifyToken, deleteProfile);


router.get("/", getUsers);
router.get("/:id", getUserById);


module.exports = router;