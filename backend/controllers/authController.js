const pool = require("../db");
const bcrypt = require("bcrypt");

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // 1. validar datos básicos
        if (!username || !email || !password) {
            return res.status(400).json({ message: "Faltan datos" });
        }

        // 2. verificar si ya existe usuario
        const existingUser = await pool.query(
            "SELECT * FROM users WHERE email = $1 OR username = $2",
            [email, username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: "Usuario ya existe" });
        }

        // 3. hashear password
        const passwordHash = await bcrypt.hash(password, 10);

        // 4. insertar usuario
        const result = await pool.query(
            "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, username, email, score",
            [username, email, passwordHash]
        );

        // 5. devolver usuario creado
        res.status(201).json({
            message: "Usuario creado correctamente",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Error en register:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};



const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. validar datos
        if (!email || !password) {
            return res.status(400).json({ message: "Faltan datos" });
        }

        // 2. buscar usuario
        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Usuario no existe" });
        }

        const user = result.rows[0];

        // 3. comparar contraseña
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return res.status(400).json({ message: "Password incorrecto" });
        }

        // 4. respuesta OK
        res.json({
            message: "Login exitoso",
            user: {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                score: user.score
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