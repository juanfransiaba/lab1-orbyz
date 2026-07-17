require("dotenv").config();
const { Pool } = require("pg");

// En producción (Railway) usamos DATABASE_URL; en local, las variables sueltas.
const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        // Los Postgres en la nube suelen pedir SSL.
        // Si tu conexión NO usa SSL, poné la variable PGSSL=disable.
        ssl:
            process.env.PGSSL === "disable"
                ? false
                : { rejectUnauthorized: false },
    })
    : new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

module.exports = pool;