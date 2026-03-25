const express = require("express");
const router = express.Router();

// endpoint de prueba
router.get("/test", (req, res) => {
    res.json({ message: "Users funcionando" });
});

module.exports = router;