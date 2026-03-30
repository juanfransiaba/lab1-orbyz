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

const updateProfile = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const userId = req.user.user_id;

        if (!username && !email && !password) {
            return res.status(400).json({ message: "No se enviaron datos para actualizar" });
        }

        const existingUser = await pool.query(
            "SELECT * FROM users WHERE user_id = $1",
            [userId]
        );

        if (existingUser.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const currentUser = existingUser.rows[0];

        const newUsername = username?.trim() || currentUser.username;
        const newEmail = email?.trim() || currentUser.email;

        let passwordHash = currentUser.password_hash;

        if (password && password.trim() !== "") {
            passwordHash = await bcrypt.hash(password, 10);
        }

        const result = await pool.query(
            `UPDATE users
             SET username = $1,
                 email = $2,
                 password_hash = $3
             WHERE user_id = $4
                 RETURNING user_id, username, email, score`,
            [newUsername, newEmail, passwordHash, userId]
        );

        res.json({
            message: "Perfil actualizado correctamente",
            user: result.rows[0]
        });
    } catch (error) {
        console.error("Error al actualizar perfil:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const deleteProfile = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const result = await pool.query(
            "DELETE FROM users WHERE user_id = $1 RETURNING user_id",
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        res.json({ message: "Cuenta eliminada correctamente" });
    } catch (error) {
        console.error("Error al eliminar perfil:", error);
        res.status(500).json({ message: "Error del servidor" });
    }


};

module.exports = {
    getUsers,
    getUserById,
    updateProfile,
    deleteProfile,
    getProfile
};