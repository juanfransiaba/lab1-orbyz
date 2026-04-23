const API_URL = import.meta.env.VITE_API_URL;

function getToken() {
    return localStorage.getItem("token");
}

function buildHeaders(customHeaders = {}) {
    const token = getToken();

    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...customHeaders,
    };
}

async function requestJSON(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        headers: buildHeaders(options.headers),
        ...options,
    });

    const contentType = response.headers.get("content-type") || "";
    const hasJsonBody = contentType.includes("application/json");
    const data = hasJsonBody ? await response.json() : null;

    if (!response.ok) {
        throw new Error(
            data?.message ||
            data?.error ||
            `La solicitud a ${path} falló con estado ${response.status}.`
        );
    }

    return data;
}

// ────── Búsqueda de usuarios ──────
export async function searchUsers(query) {
    return requestJSON(`/user/search?q=${encodeURIComponent(query)}`);
}

// ────── Amigos ──────
export async function getFriends() {
    return requestJSON("/friends");
}

export async function sendFriendRequest(addresseeId) {
    return requestJSON("/friends/request", {
        method: "POST",
        body: JSON.stringify({ addresseeId }),
    });
}

export async function getReceivedRequests() {
    return requestJSON("/friends/requests/received");
}

export async function getSentRequests() {
    return requestJSON("/friends/requests/sent");
}

export async function acceptFriendRequest(friendshipId) {
    return requestJSON(`/friends/${friendshipId}/accept`, {
        method: "PUT",
    });
}

export async function rejectFriendRequest(friendshipId) {
    return requestJSON(`/friends/${friendshipId}/reject`, {
        method: "PUT",
    });
}

export async function removeFriendship(friendshipId) {
    return requestJSON(`/friends/${friendshipId}`, {
        method: "DELETE",
    });
}