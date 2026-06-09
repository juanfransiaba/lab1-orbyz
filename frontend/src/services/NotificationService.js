import { getSocket } from "./socket";

const API_URL = import.meta.env.VITE_API_URL;

function headers() {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

export async function getNotifications() {
    const res = await fetch(`${API_URL}/notifications`, { headers: headers() });
    if (!res.ok) throw new Error("No se pudieron cargar las notificaciones");
    return res.json();
}

export async function markNotificationRead(id) {
    const res = await fetch(`${API_URL}/notifications/${id}/read`, {
        method: "PUT",
        headers: headers(),
    });
    if (!res.ok) throw new Error("No se pudo marcar como leída");
    return res.json();
}

export async function markAllNotificationsRead() {
    const res = await fetch(`${API_URL}/notifications/read-all`, {
        method: "PUT",
        headers: headers(),
    });
    if (!res.ok) throw new Error("No se pudieron marcar");
    return res.json();
}

// Push en tiempo real (requiere el socket conectado). Devuelve función para desuscribirse.
export function onNewNotification(handler) {
    const s = getSocket();
    s.on("notification:new", handler);
    return () => s.off("notification:new", handler);
}