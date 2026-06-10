const crypto = require("crypto");

const MAX_PLAYERS = 2;
const MAX_SPECTATORS = 10;

// Mapa en memoria: código -> sala
const rooms = new Map();

// Sin 0/O/1/I/L para evitar confusión al tipear el código
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode() {
    let code;
    do {
        code = "";
        for (let i = 0; i < 5; i++) {
            code += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)];
        }
    } while (rooms.has(code));
    return code;
}

function createRoom({ mode, continent, hostUserId, hostUsername, tournament }) {
    const code = generateCode();

    const room = {
        code,
        mode,
        continent: continent || null,
        hostUserId,
        status: "waiting",
        players: new Map(),
        spectators: [],
        tournament: tournament || null,   // <-- nuevo: contexto del torneo (o null si es casual)
        createdAt: new Date(),
    };

    room.players.set(hostUserId, {
        userId: hostUserId,
        username: hostUsername,
        connected: true,
    });

    rooms.set(code, room);
    return room;
}

function getRoom(code) {
    return rooms.get(code) || null;
}

function addPlayer(code, { userId, username }) {
    const room = rooms.get(code);

    if (!room) return { error: "La sala no existe" };
    if (room.status !== "waiting") return { error: "La partida ya empezó" };
    if (room.players.has(userId)) return { room }; // ya estaba dentro
    if (room.players.size >= MAX_PLAYERS) return { error: "La sala está llena" };

    room.players.set(userId, { userId, username, connected: true });
    return { room };
}

function removePlayer(code, userId) {
    const room = rooms.get(code);
    if (!room) return null;

    room.players.delete(userId);

    // Sala vacía -> se borra
    if (room.players.size === 0) {
        rooms.delete(code);
        return null;
    }

    // Si se fue el host, promover al jugador que queda
    if (room.hostUserId === userId) {
        room.hostUserId = room.players.keys().next().value;
    }

    return room;
}

// Busca en qué sala está un usuario (un usuario solo puede estar en una)
function findRoomByUser(userId) {
    for (const room of rooms.values()) {
        if (room.players.has(userId)) {
            return room;
        }
    }
    return null;
}

// El Map no viaja bien en JSON -> lo pasamos a array antes de mandar al cliente
function serializeRoom(room) {
    if (!room) return null;

    return {
        code: room.code,
        mode: room.mode,
        continent: room.continent,
        hostUserId: room.hostUserId,
        status: room.status,
        players: Array.from(room.players.values()),
        spectatorCount: room.spectators.length,
    };
}

function deleteRoom(code) {
    rooms.delete(code);
}

function addSpectator(code, { userId, username, socketId }) {
    const room = rooms.get(code);
    if (!room) return { error: "La sala no existe" };
    if (room.players.has(userId)) return { error: "Estás jugando en esta sala" };
    if (room.spectators.length >= MAX_SPECTATORS) {
        return { error: "La sala llegó al máximo de espectadores" };
    }
    // evitar duplicar el mismo socket
    if (!room.spectators.some((s) => s.socketId === socketId)) {
        room.spectators.push({ userId, username, socketId });
    }
    return { room };
}

function removeSpectator(code, socketId) {
    const room = rooms.get(code);
    if (!room) return null;
    room.spectators = room.spectators.filter((s) => s.socketId !== socketId);
    return room;
}

module.exports = {
    MAX_PLAYERS,
    MAX_SPECTATORS,
    createRoom,
    getRoom,
    addPlayer,
    removePlayer,
    deleteRoom,
    findRoomByUser,
    serializeRoom,
    addSpectator,      // <-- nuevo
    removeSpectator,   // <-- nuevo
    rooms,
};