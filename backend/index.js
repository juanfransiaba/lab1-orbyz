require("dotenv").config();
const matchesRoutes = require("./routes/matchesRoutes");

const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const cors = require("cors");
const rankingRoutes = require("./routes/rankingRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const paisesRoutes = require("./routes/paisesRoutes");
const friendsRoutes = require("./routes/friendsRoutes");
const initSocket = require("./socket");
const notificationsRoutes = require("./routes/notificationsRoutes");
const tournamentsRoutes = require("./routes/tournamentsRoutes");
const storeRoutes = require("./routes/storeRoutes");

const app = express();

function isAllowedLocalOrigin(origin) {
    if (!origin) {
        return true;
    }

    // Origen público del front en producción (Railway/Vercel/etc.)
    if (process.env.FRONTEND_URL) {
        try {
            if (new URL(origin).origin === new URL(process.env.FRONTEND_URL).origin) {
                return true;
            }
        } catch {
            // origin invalido: seguimos con el chequeo de abajo
        }
    }

    return /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$/.test(origin);
}

app.use(
    cors({
        origin(origin, callback) {
            if (isAllowedLocalOrigin(origin)) {
                return callback(null, true);
            }

            return callback(new Error("Origen no permitido por CORS"));
        },
    })
);

app.use(express.json());
app.use("/static", express.static(path.join(__dirname, "static")));

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/api/paises", paisesRoutes);
app.use("/friends", friendsRoutes);
app.use("/matches", matchesRoutes);
app.use("/ranking", rankingRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/tournaments", tournamentsRoutes);
app.use("/store", storeRoutes);

// ── Servir el frontend compilado (Vite build) ──
const frontendDist = path.join(__dirname, "..", "frontEnd", "dist");

if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));

    // SPA fallback: cualquier GET que no sea de la API devuelve index.html
    // (para que rutas de React como /online/join anden al refrescar)
    app.use((req, res, next) => {
        if (req.method !== "GET") {
            return next();
        }
        res.sendFile(path.join(frontendDist, "index.html"));
    });
}

// ── Server HTTP + Socket.IO ──
const server = http.createServer(app);
initSocket(server);

server.listen(process.env.PORT, () => {
    console.log(`Server corriendo en puerto ${process.env.PORT}`);
});
