import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL;

function getToken() {
    return localStorage.getItem("token");
}

let socket = null;

// Devuelve la instancia del socket (la crea la primera vez, sin conectar)
export function getSocket() {
    if (!socket) {
        socket = io(API_URL, {
            auth: { token: getToken() },
            autoConnect: false,
        });
    }
    return socket;
}

// Conecta (refrescando el token por si hubo re-login)
export function connectSocket() {
    const s = getSocket();
    s.auth = { token: getToken() };
    if (!s.connected) s.connect();
    return s;
}

export function disconnectSocket() {
    if (socket) socket.disconnect();
}