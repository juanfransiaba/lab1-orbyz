const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/authMiddleware");
const {
    getNotifications,
    markAllAsRead,
    markAsRead,
} = require("../controllers/notificationsController");

router.use(verifyToken);

router.get("/", getNotifications);
router.put("/read-all", markAllAsRead);
router.put("/:id/read", markAsRead);

module.exports = router;