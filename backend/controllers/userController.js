const pool = require("../db");
const bcrypt = require("bcrypt");

const getUsers = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT user_id, username, email, score FROM users"
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener usuarios:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "SELECT user_id, username, email, score FROM users WHERE user_id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error al obtener usuario por id:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};



const getProfile = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT user_id, username, email, score FROM users WHERE user_id = $1",
            [req.user.user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error en getProfile:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, password, score } = req.body;

        const existingUser = await pool.query(
            "SELECT * FROM users WHERE user_id = $1",
            [id]
        );

        if (existingUser.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        let passwordHash = existingUser.rows[0].password_hash;

        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
        }

        const result = await pool.query(
            `UPDATE users
             SET username = $1,
                 email = $2,
                 password_hash = $3,
                 score = $4
             WHERE user_id = $5
             RETURNING user_id, username, email, score`,
            [username, email, passwordHash, score, id]
        );

        res.json({
            message: "Usuario actualizado correctamente",
            user: result.rows[0]
        });
    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "DELETE FROM users WHERE user_id = $1 RETURNING user_id",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        res.json({ message: "Usuario eliminado correctamente" });
    } catch (error) {
        console.error("Error al eliminar usuario:", error);
        res.status(500).json({ message: "Error del servidor" });
    }




};

module.exports = {
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    getProfile
};