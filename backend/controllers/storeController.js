const pool = require("../db");
const {
    applyMercadoPagoPayment,
    createCoinPaymentOrder,
    ensureStoreTables,
    getCatalogItem,
    getCoinPaymentOrderForUser,
    getInventory,
    getPendingCoinPaymentOrdersForUser,
    sanitizePurchaseMetadata,
    updateCoinPaymentPreference,
} = require("../services/storeService");
const {
    createPreference,
    getPayment,
    isMercadoPagoConfigured,
    searchPayments,
} = require("../services/mercadoPagoService");

function normalizeInventory(rows) {
    return rows.reduce((acc, row) => {
        if (!acc[row.item_type]) {
            acc[row.item_type] = {};
        }

        acc[row.item_type][row.item_id] = Number(row.quantity) || 0;
        return acc;
    }, {});
}

function normalizeBaseUrl(rawUrl, fallbackUrl) {
    const value = String(rawUrl || fallbackUrl || "").trim();

    if (!value) {
        return "";
    }

    const hostOnlyValue = value.replace(/^\/+/, "");
    const isLocalHost =
        /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(hostOnlyValue) ||
        /^192\.168\.\d{1,3}\.\d{1,3}(?::\d+)?(?:\/|$)/.test(hostOnlyValue) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?(?:\/|$)/.test(hostOnlyValue) ||
        /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(?::\d+)?(?:\/|$)/.test(
            hostOnlyValue
        );
    const withProtocol = /^https?:\/\//i.test(value)
        ? value
        : `${isLocalHost ? "http" : "https"}://${hostOnlyValue}`;

    try {
        const url = new URL(withProtocol);
        return url.origin.replace(/\/$/, "");
    } catch {
        return String(fallbackUrl || "").replace(/\/$/, "");
    }
}

function getFrontendUrl(req) {
    return normalizeBaseUrl(
        process.env.FRONTEND_URL ||
            process.env.CLIENT_URL ||
            req.get("origin"),
        "http://localhost:5173"
    );
}

function getBackendPublicUrl(req) {
    const explicitUrl =
        process.env.BACKEND_PUBLIC_URL ||
        process.env.API_PUBLIC_URL ||
        process.env.MP_WEBHOOK_BASE_URL;

    if (explicitUrl) {
        return normalizeBaseUrl(explicitUrl, "");
    }

    return normalizeBaseUrl(`${req.protocol}://${req.get("host")}`, "");
}

function isLocalOrPrivateUrl(url) {
    try {
        const { hostname } = new URL(url);

        return (
            hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname === "::1" ||
            /^10\./.test(hostname) ||
            /^192\.168\./.test(hostname) ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
        );
    } catch {
        return true;
    }
}

function getMercadoPagoWebhookUrl(req) {
    if (process.env.MP_WEBHOOK_URL) {
        return process.env.MP_WEBHOOK_URL.replace(/\/$/, "");
    }

    const backendUrl = getBackendPublicUrl(req);

    if (isLocalOrPrivateUrl(backendUrl)) {
        return "";
    }

    return `${backendUrl}/store/mercadopago/webhook`;
}

function canUseMercadoPagoAutoReturn(frontendUrl) {
    try {
        const url = new URL(frontendUrl);
        return url.protocol === "https:" && !isLocalOrPrivateUrl(frontendUrl);
    } catch {
        return false;
    }
}

async function getBalanceAndInventory(userId) {
    const [userResult, inventoryRows] = await Promise.all([
        pool.query("SELECT COALESCE(score, 0) AS balance FROM users WHERE user_id = $1", [
            userId,
        ]),
        getInventory(userId),
    ]);

    return {
        balance: Number(userResult.rows[0]?.balance) || 0,
        inventory: normalizeInventory(inventoryRows),
    };
}

async function processMercadoPagoPayment(paymentId) {
    if (!paymentId) {
        return { ok: false, credited: false, reason: "missing_payment_id" };
    }

    const payment = await getPayment(paymentId);
    return applyMercadoPagoPayment(payment);
}

async function syncMercadoPagoOrder(order) {
    if (!order?.externalReference || order.credited || !isMercadoPagoConfigured()) {
        return null;
    }

    const payments = await searchPayments({
        external_reference: order.externalReference,
        sort: "date_created",
        criteria: "desc",
    });
    const results = Array.isArray(payments.results) ? payments.results : [];
    const payment =
        results.find((candidate) => candidate.status === "approved") || results[0];

    if (!payment?.id) {
        return null;
    }

    return processMercadoPagoPayment(payment.id);
}

async function getStoreState(req, res) {
    try {
        await ensureStoreTables();

        const userId = req.user.user_id;
        let userResult = await pool.query(
            "SELECT COALESCE(score, 0) AS balance FROM users WHERE user_id = $1",
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        if (isMercadoPagoConfigured()) {
            const pendingOrders = await getPendingCoinPaymentOrdersForUser(userId);

            await Promise.all(
                pendingOrders.map((order) =>
                    syncMercadoPagoOrder(order).catch((error) => {
                        console.error("Error sincronizando orden de Mercado Pago:", error);
                        return null;
                    })
                )
            );

            userResult = await pool.query(
                "SELECT COALESCE(score, 0) AS balance FROM users WHERE user_id = $1",
                [userId]
            );
        }

        const inventory = await getInventory(userId);

        res.json({
            balance: Number(userResult.rows[0].balance) || 0,
            inventory: normalizeInventory(inventory),
            mercadoPagoConfigured: isMercadoPagoConfigured(),
        });
    } catch (error) {
        console.error("Error en getStoreState:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
}

async function purchaseStoreItem(req, res) {
    const client = await pool.connect();

    try {
        await ensureStoreTables();

        const userId = req.user.user_id;
        const itemType = String(req.body.itemType || "").trim();
        const itemId = String(req.body.itemId || "").trim();
        const rawMetadata =
            req.body.metadata && typeof req.body.metadata === "object"
                ? req.body.metadata
                : {};
        const item = getCatalogItem(itemType, itemId);
        const metadata = sanitizePurchaseMetadata(itemType, itemId, rawMetadata);

        if (!item) {
            return res.status(400).json({ message: "Item de tienda invalido" });
        }

        if (itemType === "coins") {
            return res.status(400).json({
                code: "USE_MERCADO_PAGO",
                message: "Las monedas se compran con Mercado Pago.",
            });
        }

        await client.query("BEGIN");

        const userResult = await client.query(
            "SELECT COALESCE(score, 0) AS balance FROM users WHERE user_id = $1 FOR UPDATE",
            [userId]
        );

        if (userResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const currentBalance = Number(userResult.rows[0].balance) || 0;

        if (itemType === "avatars") {
            const ownedAvatarResult = await client.query(
                `SELECT quantity
                 FROM store_inventory
                 WHERE user_id = $1
                    AND item_type = 'avatars'
                    AND item_id = $2
                    AND quantity > 0`,
                [userId, itemId]
            );

            if (ownedAvatarResult.rows.length > 0) {
                await client.query("ROLLBACK");
                return res.status(409).json({
                    code: "ITEM_ALREADY_OWNED",
                    message: "Ya tenes este avatar.",
                });
            }
        }

        let costCoins = 0;
        let coinsDelta = 0;

        if (itemType === "coins") {
            coinsDelta = Number(item.grantCoins) || 0;
        } else {
            costCoins = Number(item.costCoins) || 0;

            if (currentBalance < costCoins) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    code: "INSUFFICIENT_COINS",
                    message: "No tenes monedas suficientes para comprar este item.",
                    balance: currentBalance,
                    required: costCoins,
                });
            }

            coinsDelta = -costCoins;
        }

        const updatedUser = await client.query(
            `UPDATE users
             SET score = COALESCE(score, 0) + $1
             WHERE user_id = $2
             RETURNING COALESCE(score, 0) AS balance`,
            [coinsDelta, userId]
        );

        await client.query(
            `INSERT INTO store_inventory (user_id, item_type, item_id, quantity, updated_at)
             VALUES ($1, $2, $3, 1, NOW())
             ON CONFLICT (user_id, item_type, item_id)
             DO UPDATE SET
                quantity = store_inventory.quantity + 1,
                updated_at = NOW()`,
            [userId, itemType, itemId]
        );

        await client.query(
            `INSERT INTO store_purchases
                (user_id, item_type, item_id, quantity, cost_coins, coins_delta, metadata)
             VALUES ($1, $2, $3, 1, $4, $5, $6)`,
            [userId, itemType, itemId, costCoins, coinsDelta, JSON.stringify(metadata)]
        );

        const inventoryRows = await getInventory(userId, client);

        await client.query("COMMIT");

        res.json({
            message:
                itemType === "coins"
                    ? "Monedas acreditadas correctamente."
                    : "Compra realizada correctamente.",
            balance: Number(updatedUser.rows[0].balance) || 0,
            inventory: normalizeInventory(inventoryRows),
            purchase: {
                itemType,
                itemId,
                quantity: 1,
                costCoins,
                coinsDelta,
                metadata,
            },
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error en purchaseStoreItem:", error);
        res.status(500).json({ message: "Error del servidor" });
    } finally {
        client.release();
    }
}

async function createCoinCheckout(req, res) {
    try {
        await ensureStoreTables();

        if (!isMercadoPagoConfigured()) {
            return res.status(500).json({
                code: "MERCADO_PAGO_NOT_CONFIGURED",
                message: "Falta configurar MP_ACCESS_TOKEN en el servidor.",
            });
        }

        const userId = req.user.user_id;
        const itemId = String(req.body.itemId || "").trim();
        const item = getCatalogItem("coins", itemId);

        if (!item) {
            return res.status(400).json({ message: "Pack de monedas invalido" });
        }

        const order = await createCoinPaymentOrder(userId, itemId);
        const frontendUrl = getFrontendUrl(req);
        const notificationUrl = getMercadoPagoWebhookUrl(req);
        const preferencePayload = {
            items: [
                {
                    id: item.item_id,
                    title: `ORBYZ - ${item.name}`,
                    description: `${Number(item.grantCoins).toLocaleString(
                        "es-AR"
                    )} monedas`,
                    quantity: 1,
                    currency_id: "ARS",
                    unit_price: Number(item.priceARS),
                },
            ],
            external_reference: order.externalReference,
            metadata: {
                orderId: order.orderId,
                userId,
                itemId: item.item_id,
                coins: Number(item.grantCoins) || 0,
            },
            back_urls: {
                success: `${frontendUrl}/store?mp_status=success&orderId=${order.orderId}`,
                failure: `${frontendUrl}/store?mp_status=failure&orderId=${order.orderId}`,
                pending: `${frontendUrl}/store?mp_status=pending&orderId=${order.orderId}`,
            },
        };

        if (canUseMercadoPagoAutoReturn(frontendUrl)) {
            preferencePayload.auto_return = "approved";
        }

        if (notificationUrl) {
            preferencePayload.notification_url = notificationUrl;
        }

        const preference = await createPreference(preferencePayload);
        const updatedOrder = await updateCoinPaymentPreference(order.orderId, preference);

        res.json({
            order: updatedOrder,
            preferenceId: preference.id,
            initPoint: preference.init_point,
            sandboxInitPoint: preference.sandbox_init_point,
        });
    } catch (error) {
        console.error("Error en createCoinCheckout:", error);
        res.status(error.status || 500).json({
            code: error.code || "MERCADO_PAGO_ERROR",
            message: error.message || "No se pudo crear el checkout de Mercado Pago.",
            details: error.details,
        });
    }
}

async function getCoinOrderStatus(req, res) {
    try {
        await ensureStoreTables();

        const userId = req.user.user_id;
        const { orderId } = req.params;
        const paymentId =
            req.query.payment_id || req.query.collection_id || req.query.paymentId;

        if (paymentId && isMercadoPagoConfigured()) {
            await processMercadoPagoPayment(paymentId);
        }

        let order = await getCoinPaymentOrderForUser(userId, orderId);

        if (!order) {
            return res.status(404).json({ message: "Orden no encontrada" });
        }

        if (!paymentId) {
            await syncMercadoPagoOrder(order);
            order = await getCoinPaymentOrderForUser(userId, orderId);
        }

        const state = await getBalanceAndInventory(userId);

        res.json({
            order,
            ...state,
        });
    } catch (error) {
        console.error("Error en getCoinOrderStatus:", error);
        res.status(error.status || 500).json({
            message: error.message || "No se pudo consultar la orden.",
        });
    }
}

async function mercadoPagoWebhook(req, res) {
    try {
        const topic = req.body?.type || req.query?.topic || req.query?.type;
        const paymentId =
            req.body?.data?.id ||
            req.query?.["data.id"] ||
            req.query?.id ||
            req.query?.payment_id;

        if (topic === "payment" && paymentId) {
            await processMercadoPagoPayment(paymentId);
        }

        res.sendStatus(200);
    } catch (error) {
        console.error("Error en mercadoPagoWebhook:", error);
        res.sendStatus(200);
    }
}

module.exports = {
    createCoinCheckout,
    getCoinOrderStatus,
    getStoreState,
    mercadoPagoWebhook,
    purchaseStoreItem,
};
