const pool = require("../db");
const crypto = require("crypto");

const SCREAMER_IMAGES = {
    screamer: {
        id: "screamer",
        src: "/images/paises/screamer.jpg",
    },
    "screamer-2": {
        id: "screamer-2",
        src: "/images/paises/Screamer2.jpg",
    },
};

const STORE_CATALOG = {
    coins: {
        starter: {
            item_id: "starter",
            name: "Pack Inicial",
            grantCoins: 500,
            priceARS: 999,
        },
        explorer: {
            item_id: "explorer",
            name: "Pack Explorador",
            grantCoins: 1300,
            priceARS: 1899,
        },
        master: {
            item_id: "master",
            name: "Pack Maestro",
            grantCoins: 3200,
            priceARS: 3999,
        },
        legend: {
            item_id: "legend",
            name: "Pack Leyenda",
            grantCoins: 7750,
            priceARS: 7999,
        },
    },
    abilities: {
        "fifty-fifty": {
            item_id: "fifty-fifty",
            name: "Tachar 2 opciones",
            costCoins: 300,
            powerupKey: "fiftyFifty",
        },
        freeze: {
            item_id: "freeze",
            name: "Congelar",
            costCoins: 550,
            powerupKey: "freeze",
        },
        screamer: {
            item_id: "screamer",
            name: "SCREAMER",
            costCoins: 650,
            powerupKey: "screamer",
        },
    },
    avatars: {
        "mountain-explorer": {
            item_id: "mountain-explorer",
            name: "Explorador",
            costCoins: 700,
            icon: "EX",
        },
        "ocean-guide": {
            item_id: "ocean-guide",
            name: "Guia oceanico",
            costCoins: 850,
            icon: "GO",
        },
        "world-master": {
            item_id: "world-master",
            name: "Maestro mundial",
            costCoins: 1200,
            icon: "MW",
        },
        "gigachad-mundial": {
            item_id: "gigachad-mundial",
            name: "Gigachad mundial",
            costCoins: 1500,
            icon: "GM",
            imageSrc: "/images/paises/JulianCHAD.jpg",
        },
    },
};

let ensureTablesPromise = null;

function ensureStoreTables() {
    if (!ensureTablesPromise) {
        ensureTablesPromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS store_inventory (
                    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                    item_type TEXT NOT NULL,
                    item_id TEXT NOT NULL,
                    quantity INTEGER NOT NULL DEFAULT 0,
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (user_id, item_type, item_id)
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS store_purchases (
                    purchase_id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                    item_type TEXT NOT NULL,
                    item_id TEXT NOT NULL,
                    quantity INTEGER NOT NULL DEFAULT 1,
                    cost_coins INTEGER NOT NULL DEFAULT 0,
                    coins_delta INTEGER NOT NULL DEFAULT 0,
                    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            `);

            await pool.query(`
                ALTER TABLE store_purchases
                ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb
            `);

            await pool.query(`
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS profile_avatar_id TEXT
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS store_coin_orders (
                    order_id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                    item_id TEXT NOT NULL,
                    preference_id TEXT,
                    payment_id TEXT,
                    status TEXT NOT NULL DEFAULT 'created',
                    payment_status TEXT,
                    amount_ars NUMERIC(12, 2) NOT NULL DEFAULT 0,
                    coins INTEGER NOT NULL DEFAULT 0,
                    credited BOOLEAN NOT NULL DEFAULT FALSE,
                    init_point TEXT,
                    sandbox_init_point TEXT,
                    external_reference TEXT UNIQUE NOT NULL,
                    raw_payment JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            `);

            await pool.query(`
                INSERT INTO store_inventory (user_id, item_type, item_id, quantity, updated_at)
                SELECT user_id, item_type, 'gigachad-mundial', quantity, updated_at
                FROM store_inventory
                WHERE item_type = 'avatars'
                    AND item_id = 'golden-compass'
                ON CONFLICT (user_id, item_type, item_id)
                DO UPDATE SET
                    quantity = store_inventory.quantity + EXCLUDED.quantity,
                    updated_at = GREATEST(store_inventory.updated_at, EXCLUDED.updated_at)
            `);

            await pool.query(`
                DELETE FROM store_inventory
                WHERE item_type = 'avatars'
                    AND item_id = 'golden-compass'
            `);

            await pool.query(`
                UPDATE store_purchases
                SET item_id = 'gigachad-mundial'
                WHERE item_type = 'avatars'
                    AND item_id = 'golden-compass'
            `);

            await pool.query(`
                UPDATE users
                SET profile_avatar_id = 'gigachad-mundial'
                WHERE profile_avatar_id = 'golden-compass'
            `);
        })();
    }

    return ensureTablesPromise;
}

function getCatalogItem(itemType, itemId) {
    return STORE_CATALOG[itemType]?.[itemId] || null;
}

function normalizeCoinOrder(row) {
    if (!row) {
        return null;
    }

    return {
        orderId: row.order_id,
        userId: row.user_id,
        itemId: row.item_id,
        preferenceId: row.preference_id,
        paymentId: row.payment_id,
        status: row.status,
        paymentStatus: row.payment_status,
        amountARS: Number(row.amount_ars) || 0,
        coins: Number(row.coins) || 0,
        credited: Boolean(row.credited),
        initPoint: row.init_point,
        sandboxInitPoint: row.sandbox_init_point,
        externalReference: row.external_reference,
    };
}

function getScreamerImage(imageId) {
    return SCREAMER_IMAGES[imageId] || SCREAMER_IMAGES.screamer;
}

function getAvatarProfile(avatarId) {
    const avatar = getCatalogItem("avatars", avatarId);

    if (!avatar) {
        return null;
    }

    return {
        id: avatar.item_id,
        name: avatar.name,
        icon: avatar.icon || null,
        imageSrc: avatar.imageSrc || null,
    };
}

function sanitizePurchaseMetadata(itemType, itemId, metadata = {}) {
    if (itemType === "abilities" && itemId === "screamer") {
        return {
            screamerImageId: getScreamerImage(metadata.screamerImageId).id,
        };
    }

    return {};
}

async function getInventory(userId, client = pool) {
    await ensureStoreTables();

    const { rows } = await client.query(
        `SELECT item_type, item_id, quantity
         FROM store_inventory
         WHERE user_id = $1
         ORDER BY item_type ASC, item_id ASC`,
        [userId]
    );

    return rows;
}

async function createCoinPaymentOrder(userId, itemId, client = pool) {
    await ensureStoreTables();

    const item = getCatalogItem("coins", itemId);

    if (!item) {
        throw new Error("Pack de monedas invalido");
    }

    const orderId = crypto.randomUUID();
    const externalReference = `orbyz-coins-${orderId}`;
    const { rows } = await client.query(
        `INSERT INTO store_coin_orders
            (order_id, user_id, item_id, status, amount_ars, coins, external_reference)
         VALUES ($1, $2, $3, 'created', $4, $5, $6)
         RETURNING *`,
        [
            orderId,
            userId,
            item.item_id,
            Number(item.priceARS) || 0,
            Number(item.grantCoins) || 0,
            externalReference,
        ]
    );

    return normalizeCoinOrder(rows[0]);
}

async function updateCoinPaymentPreference(orderId, preference, client = pool) {
    await ensureStoreTables();

    const { rows } = await client.query(
        `UPDATE store_coin_orders
         SET preference_id = $2,
             init_point = $3,
             sandbox_init_point = $4,
             status = 'pending_payment',
             updated_at = NOW()
         WHERE order_id = $1
         RETURNING *`,
        [
            orderId,
            preference.id || null,
            preference.init_point || null,
            preference.sandbox_init_point || null,
        ]
    );

    return normalizeCoinOrder(rows[0]);
}

async function getCoinPaymentOrderForUser(userId, orderId, client = pool) {
    await ensureStoreTables();

    const { rows } = await client.query(
        `SELECT *
         FROM store_coin_orders
         WHERE user_id = $1
            AND order_id = $2`,
        [userId, orderId]
    );

    return normalizeCoinOrder(rows[0]);
}

async function getPendingCoinPaymentOrdersForUser(userId, client = pool) {
    await ensureStoreTables();

    const { rows } = await client.query(
        `SELECT *
         FROM store_coin_orders
         WHERE user_id = $1
            AND credited = FALSE
            AND status IN ('created', 'pending_payment', 'pending', 'in_process')
         ORDER BY updated_at DESC
         LIMIT 5`,
        [userId]
    );

    return rows.map(normalizeCoinOrder);
}

async function applyMercadoPagoPayment(payment) {
    await ensureStoreTables();

    const externalReference = payment?.external_reference;

    if (!externalReference) {
        return { ok: false, credited: false, reason: "missing_external_reference" };
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { rows } = await client.query(
            `SELECT *
             FROM store_coin_orders
             WHERE external_reference = $1
             FOR UPDATE`,
            [externalReference]
        );
        const order = rows[0];

        if (!order) {
            await client.query("COMMIT");
            return { ok: false, credited: false, reason: "order_not_found" };
        }

        const paymentId = String(payment.id || "");
        const paymentStatus = String(payment.status || "");
        const paidAmount = Number(payment.transaction_amount) || 0;
        const expectedAmount = Number(order.amount_ars) || 0;
        const rawPayment = JSON.stringify(payment || {});

        await client.query(
            `UPDATE store_coin_orders
             SET payment_id = COALESCE($2, payment_id),
                 payment_status = $3,
                 status = $4,
                 raw_payment = $5,
                 updated_at = NOW()
             WHERE order_id = $1`,
            [order.order_id, paymentId || null, paymentStatus, paymentStatus, rawPayment]
        );

        if (paymentStatus !== "approved") {
            await client.query("COMMIT");
            return {
                ok: true,
                credited: false,
                status: paymentStatus,
                order: normalizeCoinOrder({ ...order, payment_id: paymentId }),
            };
        }

        if (paidAmount + 0.01 < expectedAmount) {
            await client.query(
                `UPDATE store_coin_orders
                 SET status = 'amount_mismatch',
                     updated_at = NOW()
                 WHERE order_id = $1`,
                [order.order_id]
            );
            await client.query("COMMIT");
            return { ok: false, credited: false, reason: "amount_mismatch" };
        }

        if (!order.credited) {
            await client.query(
                `UPDATE users
                 SET score = COALESCE(score, 0) + $1
                 WHERE user_id = $2`,
                [Number(order.coins) || 0, order.user_id]
            );

            await client.query(
                `INSERT INTO store_inventory (user_id, item_type, item_id, quantity, updated_at)
                 VALUES ($1, 'coins', $2, 1, NOW())
                 ON CONFLICT (user_id, item_type, item_id)
                 DO UPDATE SET
                    quantity = store_inventory.quantity + 1,
                    updated_at = NOW()`,
                [order.user_id, order.item_id]
            );

            await client.query(
                `INSERT INTO store_purchases
                    (user_id, item_type, item_id, quantity, cost_coins, coins_delta, metadata)
                 VALUES ($1, 'coins', $2, 1, 0, $3, $4)`,
                [
                    order.user_id,
                    order.item_id,
                    Number(order.coins) || 0,
                    JSON.stringify({
                        provider: "mercadopago",
                        orderId: order.order_id,
                        preferenceId: order.preference_id,
                        paymentId,
                    }),
                ]
            );
        }

        const updated = await client.query(
            `UPDATE store_coin_orders
             SET credited = TRUE,
                 status = 'approved',
                 payment_status = 'approved',
                 updated_at = NOW()
             WHERE order_id = $1
             RETURNING *`,
            [order.order_id]
        );

        await client.query("COMMIT");

        return {
            ok: true,
            credited: !order.credited,
            alreadyCredited: Boolean(order.credited),
            order: normalizeCoinOrder(updated.rows[0]),
        };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function getOwnedAvatarsForUser(userId, client = pool) {
    await ensureStoreTables();

    const { rows } = await client.query(
        `SELECT item_id, quantity
         FROM store_inventory
         WHERE user_id = $1
            AND item_type = 'avatars'
            AND quantity > 0
         ORDER BY updated_at DESC, item_id ASC`,
        [userId]
    );

    return rows
        .map((row) => {
            const avatar = getAvatarProfile(row.item_id);

            if (!avatar) {
                return null;
            }

            return {
                ...avatar,
                quantity: Number(row.quantity) || 0,
            };
        })
        .filter(Boolean);
}

async function consumeInventoryItem(userId, itemType, itemId, quantity = 1, client = pool) {
    await ensureStoreTables();

    const consumeQuantity = Math.max(1, Number(quantity) || 1);
    const { rows } = await client.query(
        `UPDATE store_inventory
         SET quantity = quantity - $4,
             updated_at = NOW()
         WHERE user_id = $1
            AND item_type = $2
            AND item_id = $3
            AND quantity >= $4
         RETURNING quantity`,
        [userId, itemType, itemId, consumeQuantity]
    );

    if (rows.length === 0) {
        return { ok: false, quantity: 0 };
    }

    const remainingQuantity = Math.max(0, Number(rows[0].quantity) || 0);

    if (remainingQuantity === 0) {
        await client.query(
            `DELETE FROM store_inventory
             WHERE user_id = $1
                AND item_type = $2
                AND item_id = $3
                AND quantity <= 0`,
            [userId, itemType, itemId]
        );
    }

    return { ok: true, quantity: remainingQuantity };
}

async function getPurchasedPowerupsForUser(userId) {
    const inventory = await getInventory(userId);
    const powerups = { fiftyFifty: 0, freeze: 0, screamer: 0 };

    inventory
        .filter((item) => item.item_type === "abilities")
        .forEach((item) => {
            const catalogItem = getCatalogItem("abilities", item.item_id);

            if (catalogItem?.powerupKey) {
                powerups[catalogItem.powerupKey] = Number(item.quantity) || 0;
            }
        });

    return powerups;
}

async function getLatestScreamerImageForUser(userId) {
    await ensureStoreTables();

    const { rows } = await pool.query(
        `SELECT metadata
         FROM store_purchases
         WHERE user_id = $1
            AND item_type = 'abilities'
            AND item_id = 'screamer'
         ORDER BY created_at DESC, purchase_id DESC
         LIMIT 1`,
        [userId]
    );

    return getScreamerImage(rows[0]?.metadata?.screamerImageId);
}

module.exports = {
    SCREAMER_IMAGES,
    STORE_CATALOG,
    ensureStoreTables,
    applyMercadoPagoPayment,
    consumeInventoryItem,
    createCoinPaymentOrder,
    getAvatarProfile,
    getCatalogItem,
    getCoinPaymentOrderForUser,
    getLatestScreamerImageForUser,
    getInventory,
    getOwnedAvatarsForUser,
    getPendingCoinPaymentOrdersForUser,
    getPurchasedPowerupsForUser,
    getScreamerImage,
    sanitizePurchaseMetadata,
    updateCoinPaymentPreference,
};
