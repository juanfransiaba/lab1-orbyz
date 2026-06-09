const pool = require("../db");

const getNotifications = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT notification_id, user_id, type, payload, read, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [req.user.user_id]
        );

        res.json(rows);
    } catch (error) {
        console.error("Error al obtener notificaciones:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const { rows } = await pool.query(
            `UPDATE notifications
             SET read = TRUE
             WHERE notification_id = $1
               AND user_id = $2
             RETURNING notification_id, user_id, type, payload, read, created_at`,
            [id, req.user.user_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Notificacion no encontrada" });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error("Error al marcar notificacion:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        const { rowCount } = await pool.query(
            `UPDATE notifications
             SET read = TRUE
             WHERE user_id = $1
               AND read = FALSE`,
            [req.user.user_id]
        );

        res.json({ ok: true, updated: rowCount });
    } catch (error) {
        console.error("Error al marcar notificaciones:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

module.exports = {
    getNotifications,
    markAllAsRead,
    markAsRead,
};
