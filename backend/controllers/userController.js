const pool = require("../db");
const bcrypt = require("bcrypt");
const { validatePassword } = require('../utils/passwordValidator');
const { validateUsername, validateEmail } = require('../utils/userValidator');
const {
    ensureStoreTables,
    getAvatarProfile,
    getOwnedAvatarsForUser,
} = require("../services/storeService");

const VALID_ROLES = ["user", "admin"];

function serializeProfileUser(user, ownedAvatars = []) {
    const avatar = getAvatarProfile(user.profile_avatar_id);

    return {
        ...user,
        profile_avatar_id: avatar?.id || null,
        avatar,
        ownedAvatars,
    };
}

const getUsers = async (req, res) => {
    try {
        await ensureStoreTables();

        const result = await pool.query(
            "SELECT user_id, username, email, score, roles, profile_avatar_id FROM users ORDER BY username ASC"
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener usuarios:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const getUserById = async (req, res) => {
    try {
        await ensureStoreTables();

        const { id } = req.params;

        const result = await pool.query(
            "SELECT user_id, username, email, score, roles, profile_avatar_id FROM users WHERE user_id = $1",
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

const getLeaderboard = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT user_id, username, COALESCE(score, 0) AS score
             FROM users
             ORDER BY COALESCE(score, 0) DESC, username ASC
             LIMIT 50`
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error al obtener ranking:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const getProfile = async (req, res) => {
    try {
        await ensureStoreTables();

        const result = await pool.query(
            "SELECT user_id, username, email, score, roles, profile_avatar_id FROM users WHERE user_id = $1",
            [req.user.user_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const ownedAvatars = await getOwnedAvatarsForUser(req.user.user_id);

        res.json(serializeProfileUser(result.rows[0], ownedAvatars));
    } catch (error) {
        console.error("Error en getProfile:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const updateProfile = async (req, res) => {
    try {
        await ensureStoreTables();

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

        // ── Validar formato solo si el usuario lo está cambiando ──
        if (newUsername !== currentUser.username) {
            const usernameError = validateUsername(newUsername);
            if (usernameError) {
                return res.status(400).json({ message: usernameError });
            }
        }

        if (newEmail !== currentUser.email) {
            const emailError = validateEmail(newEmail);
            if (emailError) {
                return res.status(400).json({ message: emailError });
            }
        }

        // ── Chequear que el username no esté en uso por otro usuario ──
        if (newUsername.toLowerCase() !== currentUser.username.toLowerCase()) {
            const usernameTaken = await pool.query(
                "SELECT user_id FROM users WHERE LOWER(username) = LOWER($1) AND user_id <> $2",
                [newUsername, userId]
            );

            if (usernameTaken.rows.length > 0) {
                return res.status(409).json({ message: "El nombre de usuario ya está en uso" });
            }
        }

        // ── Chequear que el email no esté en uso por otro usuario ──
        if (newEmail.toLowerCase() !== currentUser.email.toLowerCase()) {
            const emailTaken = await pool.query(
                "SELECT user_id FROM users WHERE LOWER(email) = LOWER($1) AND user_id <> $2",
                [newEmail, userId]
            );

            if (emailTaken.rows.length > 0) {
                return res.status(409).json({ message: "El email ya está en uso" });
            }
        }

        let passwordHash = currentUser.password_hash;

        if (password && password.trim() !== "") {
            const passwordError = validatePassword(password);
            if (passwordError) {
                return res.status(400).json({ message: passwordError });
            }
            passwordHash = await bcrypt.hash(password, 10);
        }

        const result = await pool.query(
            `UPDATE users
             SET username = $1,
                 email = $2,
                 password_hash = $3
             WHERE user_id = $4
             RETURNING user_id, username, email, score, roles, profile_avatar_id`,
            [newUsername, newEmail, passwordHash, userId]
        );
        const ownedAvatars = await getOwnedAvatarsForUser(userId);

        res.json({
            message: "Perfil actualizado correctamente",
            user: serializeProfileUser(result.rows[0], ownedAvatars)
        });
    } catch (error) {
        console.error("Error al actualizar perfil:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const updateProfileAvatar = async (req, res) => {
    try {
        await ensureStoreTables();

        const userId = req.user.user_id;
        const avatarId = String(req.body.avatarId || "").trim();
        const avatar = getAvatarProfile(avatarId);

        if (!avatar) {
            return res.status(400).json({ message: "Avatar invalido" });
        }

        const ownedAvatars = await getOwnedAvatarsForUser(userId);
        const ownsAvatar = ownedAvatars.some((ownedAvatar) => ownedAvatar.id === avatarId);

        if (!ownsAvatar) {
            return res.status(403).json({ message: "No compraste este avatar" });
        }

        const result = await pool.query(
            `UPDATE users
             SET profile_avatar_id = $1
             WHERE user_id = $2
             RETURNING user_id, username, email, score, roles, profile_avatar_id`,
            [avatarId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        res.json({
            message: "Avatar actualizado correctamente",
            user: serializeProfileUser(result.rows[0], ownedAvatars),
        });
    } catch (error) {
        console.error("Error al actualizar avatar:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({ message: "Rol invalido" });
        }

        const result = await pool.query(
            `UPDATE users
             SET roles = $1
             WHERE user_id = $2
             RETURNING user_id, username, email, score, roles`,
            [role, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        res.json({
            message: "Rol actualizado correctamente",
            user: result.rows[0],
        });
    } catch (error) {
        console.error("Error al actualizar rol:", error);
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

const searchUsers = async (req, res) => {
    try {
        const { q } = req.query;
        const currentUserId = req.user.user_id;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                message: "La búsqueda debe tener al menos 2 caracteres",
            });
        }

        const { rows } = await pool.query(
            `SELECT user_id, username
             FROM users
             WHERE LOWER(username) LIKE LOWER($1)
               AND user_id <> $2
             ORDER BY username ASC
             LIMIT 20`,
            [`%${q.trim()}%`, currentUserId]
        );

        res.json(rows);
    } catch (error) {
        console.error("Error en searchUsers:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

module.exports = {
    getUsers,
    getUserById,
    getLeaderboard,
    updateProfile,
    updateProfileAvatar,
    updateUserRole,
    deleteProfile,
    getProfile,
    searchUsers,
};
