const crypto = require("crypto");

const MAX_PLAYERS = 2;

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

function createRoom({ mode, continent, hostUserId, hostUsername }) {
    const code = generateCode();

    const room = {
        code,
        mode,
        continent: continent || null,
        hostUserId,
        status: "waiting", // waiting | playing | finished
        players: new Map(),
        spectators: [], // preparado para más adelante
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

module.exports = {
    MAX_PLAYERS,
    createRoom,
    getRoom,
    addPlayer,
    removePlayer,
    deleteRoom,
    findRoomByUser,
    serializeRoom,
    rooms,
};