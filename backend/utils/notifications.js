const pool = require("../db");
const { getIO } = require("../socket/ioRef");

// Crea una notificación en la DB y la empuja en tiempo real si el usuario está conectado
async function createNotification(userId, type, payload = {}) {
    try {
        const { rows } = await pool.query(
            `INSERT INTO notifications (user_id, type, payload)
             VALUES ($1, $2, $3)
             RETURNING notification_id, user_id, type, payload, read, created_at`,
            [userId, type, JSON.stringify(payload)]
        );
        const notification = rows[0];

        const io = getIO();
        if (io) {
            io.to(`user:${userId}`).emit("notification:new", notification);
        }

        return notification;
    } catch (error) {
        console.error("Error creando notificación:", error);
    }
}

module.exports = { createNotification };