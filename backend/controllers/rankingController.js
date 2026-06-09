const pool = require("../db");

// GET /ranking/global — todos los usuarios ordenados por puntos (top 100)
// No exponemos el email acá (serían datos de gente que no es tu amigo)
const getGlobalRanking = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT user_id, username, score
             FROM users
             ORDER BY score DESC, username ASC
             LIMIT 100`
        );
        res.json(rows);
    } catch (error) {
        console.error("Error en getGlobalRanking:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

// GET /ranking/friends — vos + tus amigos aceptados, ordenados por puntos
const getFriendsRanking = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const { rows } = await pool.query(
            `SELECT u.user_id, u.username, u.email, u.score,
                    (u.user_id = $1) AS is_me
             FROM users u
             WHERE u.user_id = $1
                OR u.user_id IN (
                    SELECT CASE
                               WHEN f.requester_id = $1 THEN f.addressee_id
                               ELSE f.requester_id
                           END
                    FROM friendships f
                    WHERE f.status = 'accepted'
                      AND (f.requester_id = $1 OR f.addressee_id = $1)
                )
             ORDER BY u.score DESC, u.username ASC`,
            [userId]
        );

        res.json(rows);
    } catch (error) {
        console.error("Error en getFriendsRanking:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

module.exports = { getGlobalRanking, getFriendsRanking };