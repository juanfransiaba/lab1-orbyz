import { connectSocket, getSocket } from "./socket";

export function emitWithAck(eventName, payload = {}) {
    return new Promise((resolve, reject) => {
        const socket = getSocket();

        socket.emit(eventName, payload, (response = {}) => {
            if (response.error) {
                const error = new Error(response.error);
                Object.assign(error, response);
                reject(error);
                return;
            }

            resolve(response);
        });
    });
}

export function connectOnlineSocket() {
    return new Promise((resolve, reject) => {
        const socket = connectSocket();

        if (socket.connected) {
            resolve(socket);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            reject(new Error("No se pudo conectar al servidor online."));
        }, 7000);

        socket.once("connect", () => {
            window.clearTimeout(timeoutId);
            resolve(socket);
        });

        socket.once("connect_error", (error) => {
            window.clearTimeout(timeoutId);
            reject(error);
        });
    });
}

export function decodeToken(token) {
    try {
        const payload = token.split(".")[1];
        const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}
