const API_URL = import.meta.env.VITE_API_URL;

function getToken() {
    return localStorage.getItem("token");
}

async function requestJSON(path) {
    const response = await fetch(`${API_URL}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;

    if (!response.ok) {
        throw new Error(data?.message || data?.error || "No se pudo cargar el ranking.");
    }

    return data;
}

function normalizePlayer(player, index) {
    return {
        id: player?.user_id ?? player?.userId ?? player?.id ?? `player-${index}`,
        username: player?.username ?? player?.nombre ?? "Jugador",
        score: Number(player?.score) || 0,
        isMe: Boolean(player?.is_me ?? player?.isMe),
        rank: index + 1,
    };
}

export async function getLeaderboard() {
    const data = await requestJSON("/ranking/global");
    return Array.isArray(data) ? data.map(normalizePlayer) : [];
}

export async function getGlobalLeaderboard() {
    const data = await requestJSON("/ranking/global");
    return Array.isArray(data) ? data.map(normalizePlayer) : [];
}

export async function getFriendsLeaderboard() {
    const data = await requestJSON("/ranking/friends");
    return Array.isArray(data) ? data.map(normalizePlayer) : [];
}

export async function getCurrentProfile() {
    return requestJSON("/user/profile");
}
