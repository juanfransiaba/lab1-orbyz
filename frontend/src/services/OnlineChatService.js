import { getSocket } from "./socket";

export function sendChatMessage(text) {
    return new Promise((resolve, reject) => {
        const socket = getSocket();

        socket.emit("chat:message", { text }, (response = {}) => {
            if (response.error) {
                reject(new Error(response.error));
                return;
            }

            resolve(response);
        });
    });
}

export function onChatMessage(handler) {
    const socket = getSocket();

    socket.on("chat:message", handler);
    return () => socket.off("chat:message", handler);
}
