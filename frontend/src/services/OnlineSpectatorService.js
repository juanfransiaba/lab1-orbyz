import { getSocket } from "./socket";

// Entra como espectador. Devuelve el snapshot inicial de la partida.
export function joinAsSpectator(code) {
    return new Promise((resolve, reject) => {
        const socket = getSocket();
        socket.emit("spectator:join", { code }, (res) => {
            if (res?.error) reject(new Error(res.error));
            else resolve(res.snapshot);
        });
    });
}

export function leaveSpectator() {
    return new Promise((resolve) => {
        getSocket().emit("spectator:leave", {}, () => resolve());
    });
}

// Suscripciones en vivo. Cada una devuelve una función para desuscribirse.
function subscribe(event, handler) {
    const s = getSocket();
    s.on(event, handler);
    return () => s.off(event, handler);
}

export const onProgress        = (h) => subscribe("game:progress", h);
export const onPowerupAwarded  = (h) => subscribe("powerup:awarded", h);
export const onPlayerFrozen    = (h) => subscribe("player:frozen", h);
export const onGameOver        = (h) => subscribe("game:over", h);
export const onGameAbandoned   = (h) => subscribe("game:abandoned", h);
export const onSpectatorUpdate = (h) => subscribe("spectator:update", h);