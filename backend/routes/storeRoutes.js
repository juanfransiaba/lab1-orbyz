const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const {
    createCoinCheckout,
    getCoinOrderStatus,
    getStoreState,
    mercadoPagoWebhook,
    purchaseStoreItem,
} = require("../controllers/storeController");

const router = express.Router();

router.get("/me", verifyToken, getStoreState);
router.post("/purchase", verifyToken, purchaseStoreItem);
router.post("/coins/checkout", verifyToken, createCoinCheckout);
router.get("/coins/orders/:orderId", verifyToken, getCoinOrderStatus);
router.post("/mercadopago/webhook", mercadoPagoWebhook);

module.exports = router;
