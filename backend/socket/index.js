const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const registerGameHandlers = require("./gameHandlers");
const registerLobbyHandlers = require("./lobbyHandlers");
const handleConnection = require("./connectionHandlers");
const registerChatHandlers = require("./chatHandlers");
const registerSpectatorHandlers = require("./spectatorHandlers");
const { setIO } = require("./ioRef");

function isAllowedLocalOrigin(origin) {
    if (!origin) {
        return true;
    }
    return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function initSocket(server) {
    const io = new Server(server, {
        cors: {
            origin(origin, callback) {
                if (isAllowedLocalOrigin(origin)) {
                    return callback(null, true);
                }
                return callback(new Error("Origen no permitido por CORS"));
            },
        },
    });

    // Guardar la instancia para poder mandar notificaciones desde cualquier lado
    setIO(io);

    // Autenticación por JWT
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error("Token faltante"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded; // { user_id, email, roles }
            next();
        } catch (error) {
            next(new Error("Token inválido"));
        }
    });

    io.on("connection", (socket) => {
        console.log(
            `Socket conectado: usuario ${socket.user.user_id} (socket ${socket.id})`
        );

        // Sala personal para mandarle notificaciones a este usuario donde sea que esté
        socket.join(`user:${socket.user.user_id}`);

        registerLobbyHandlers(io, socket);
        registerGameHandlers(io, socket);
        registerChatHandlers(io, socket);
        registerSpectatorHandlers(io, socket);
        handleConnection(io, socket);

        socket.on("disconnect", (reason) => {
            console.log(
                `Socket desconectado: usuario ${socket.user.user_id} (${reason})`
            );
        });
    });

    console.log("Socket.IO inicializado");
    return io;
}

module.exports = initSocket;