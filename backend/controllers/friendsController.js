const pool = require("../db");

// ────────────────────────────────────────────────
// Helper: buscar amistad existente entre dos usuarios (en cualquier dirección)
// ────────────────────────────────────────────────
async function findFriendshipBetween(userA, userB) {
    const { rows } = await pool.query(
        `SELECT * FROM friendships
         WHERE (requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1)`,
        [userA, userB]
    );
    return rows[0] || null;
}

// ────────────────────────────────────────────────
// POST /friends/request   body: { addresseeId }
// ────────────────────────────────────────────────
const sendFriendRequest = async (req, res) => {
    try {
        const requesterId = req.user.user_id;
        const { addresseeId } = req.body;

        if (!addresseeId) {
            return res.status(400).json({ message: "Falta el id del destinatario" });
        }

        const addresseeIdNum = parseInt(addresseeId, 10);
        if (Number.isNaN(addresseeIdNum)) {
            return res.status(400).json({ message: "Id de destinatario inválido" });
        }

        if (addresseeIdNum === requesterId) {
            return res.status(400).json({ message: "No podés mandarte una solicitud a vos mismo" });
        }

        // Chequear que el destinatario exista
        const userCheck = await pool.query(
            "SELECT user_id FROM users WHERE user_id = $1",
            [addresseeIdNum]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        // Chequear si ya existe una amistad en cualquier dirección
        const existing = await findFriendshipBetween(requesterId, addresseeIdNum);

        if (existing) {
            if (existing.status === "accepted") {
                return res.status(409).json({ message: "Ya son amigos" });
            }
            if (existing.status === "pending") {
                return res.status(409).json({ message: "Ya existe una solicitud pendiente" });
            }
            // Si estaba rechazada, la reutilizamos para mandar otra
            const { rows } = await pool.query(
                `UPDATE friendships
                 SET requester_id = $1,
                     addressee_id = $2,
                     status = 'pending',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE friendship_id = $3
                 RETURNING *`,
                [requesterId, addresseeIdNum, existing.friendship_id]
            );
            return res.status(201).json({
                message: "Solicitud enviada",
                friendship: rows[0],
            });
        }

        const { rows } = await pool.query(
            `INSERT INTO friendships (requester_id, addressee_id, status)
             VALUES ($1, $2, 'pending')
             RETURNING *`,
            [requesterId, addresseeIdNum]
        );

        res.status(201).json({
            message: "Solicitud enviada",
            friendship: rows[0],
        });
    } catch (error) {
        console.error("Error en sendFriendRequest:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// ────────────────────────────────────────────────
// GET /friends/requests/received
// ────────────────────────────────────────────────
const getReceivedRequests = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const { rows } = await pool.query(
            `SELECT f.friendship_id, f.status, f.created_at,
                    u.user_id, u.username, u.email
             FROM friendships f
             JOIN users u ON u.user_id = f.requester_id
             WHERE f.addressee_id = $1 AND f.status = 'pending'
             ORDER BY f.created_at DESC`,
            [userId]
        );

        res.json(rows);
    } catch (error) {
        console.error("Error en getReceivedRequests:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// ────────────────────────────────────────────────
// GET /friends/requests/sent
// ────────────────────────────────────────────────
const getSentRequests = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const { rows } = await pool.query(
            `SELECT f.friendship_id, f.status, f.created_at,
                    u.user_id, u.username, u.email
             FROM friendships f
             JOIN users u ON u.user_id = f.addressee_id
             WHERE f.requester_id = $1 AND f.status = 'pending'
             ORDER BY f.created_at DESC`,
            [userId]
        );

        res.json(rows);
    } catch (error) {
        console.error("Error en getSentRequests:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// ────────────────────────────────────────────────
// PUT /friends/:friendshipId/accept
// ────────────────────────────────────────────────
const acceptFriendRequest = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { friendshipId } = req.params;

        const { rows } = await pool.query(
            `UPDATE friendships
             SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
             WHERE friendship_id = $1
               AND addressee_id = $2
               AND status = 'pending'
             RETURNING *`,
            [friendshipId, userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Solicitud no encontrada o no podés aceptarla",
            });
        }

        res.json({
            message: "Solicitud aceptada",
            friendship: rows[0],
        });
    } catch (error) {
        console.error("Error en acceptFriendRequest:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// ────────────────────────────────────────────────
// PUT /friends/:friendshipId/reject
// ────────────────────────────────────────────────
const rejectFriendRequest = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { friendshipId } = req.params;

        const { rows } = await pool.query(
            `UPDATE friendships
             SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
             WHERE friendship_id = $1
               AND addressee_id = $2
               AND status = 'pending'
             RETURNING *`,
            [friendshipId, userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Solicitud no encontrada o no podés rechazarla",
            });
        }

        res.json({
            message: "Solicitud rechazada",
            friendship: rows[0],
        });
    } catch (error) {
        console.error("Error en rejectFriendRequest:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// ────────────────────────────────────────────────
// GET /friends   — lista de amigos aceptados
// ────────────────────────────────────────────────
const getFriends = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const { rows } = await pool.query(
            `SELECT f.friendship_id, f.created_at,
                    u.user_id, u.username, u.email, u.score
             FROM friendships f
             JOIN users u
               ON u.user_id = CASE
                   WHEN f.requester_id = $1 THEN f.addressee_id
                   ELSE f.requester_id
               END
             WHERE (f.requester_id = $1 OR f.addressee_id = $1)
               AND f.status = 'accepted'
             ORDER BY u.username ASC`,
            [userId]
        );

        res.json(rows);
    } catch (error) {
        console.error("Error en getFriends:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// ────────────────────────────────────────────────
// DELETE /friends/:friendshipId
//   — sirve para eliminar amigo Y para cancelar solicitud enviada
// ────────────────────────────────────────────────
const removeFriendship = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { friendshipId } = req.params;

        const { rows } = await pool.query(
            `DELETE FROM friendships
             WHERE friendship_id = $1
               AND (requester_id = $2 OR addressee_id = $2)
             RETURNING *`,
            [friendshipId, userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Amistad no encontrada o no te pertenece",
            });
        }

        res.json({ message: "Amistad eliminada", friendship: rows[0] });
    } catch (error) {
        console.error("Error en removeFriendship:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

module.exports = {
    sendFriendRequest,
    getReceivedRequests,
    getSentRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    getFriends,
    removeFriendship,
};