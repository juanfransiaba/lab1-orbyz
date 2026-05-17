require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const paisesRoutes = require("./routes/paisesRoutes");
const friendsRoutes = require("./routes/friendsRoutes");
const matchesRoutes = require("./routes/matchesRoutes");

const app = express();

function isAllowedLocalOrigin(origin) {
    if (!origin) {
        return true;
    }

    return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
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

app.get("/", (req, res) => {
    res.send("Backend funcionando");
});

app.listen(process.env.PORT, () => {
    console.log(`Server corriendo en puerto ${process.env.PORT}`);
});
