const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: "Faltan datos" });
        }

        const existingUser = await pool.query(
            "SELECT * FROM users WHERE email = $1 OR username = $2",
            [email, username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: "Usuario ya existe" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, username, email, score",
            [username, email, passwordHash]
        );

        const user = result.rows[0];

        const token = jwt.sign(
            {
                user_id: user.user_id,
                email: user.email,
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.status(201).json({
            message: "Usuario creado correctamente",
            token,
            user,
        });
    } catch (error) {
        console.error("Error en register:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ message: "Faltan datos" });
        }

        const cleanIdentifier = identifier.trim();

        const result = await pool.query(
            "SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)",
            [cleanIdentifier]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Usuario no existe" });
        }

        const user = result.rows[0];

        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return res.status(400).json({ message: "Password incorrecto" });
        }

        const token = jwt.sign(
            {
                user_id: user.user_id,
                email: user.email,
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            message: "Login exitoso",
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                score: user.score,
            }
        });
    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const logout = (req, res) => {
    res.json({ message: "Logout exitoso" });
};

module.exports = {
    register,
    login,
    logout
};