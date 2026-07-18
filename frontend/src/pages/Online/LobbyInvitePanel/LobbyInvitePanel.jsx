import { useEffect, useState } from "react";
import { getFriends, inviteFriendToRoom } from "../../../services/FriendService.js";
import "./LobbyInvitePanel.css";

function LobbyInvitePanel({ code }) {
    const [open, setOpen] = useState(false);
    const [friends, setFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    // estado por amigo: { [userId]: "sending" | "sent" | "error" }
    const [statusById, setStatusById] = useState({});

    useEffect(() => {
        let active = true;

        getFriends()
            .then((data) => {
                if (active) setFriends(Array.isArray(data) ? data : []);
            })
            .catch((err) => {
                if (active) {
                    setError(err.message || "No se pudieron cargar tus amigos.");
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    async function handleInvite(friend) {
        if (!code) return;
        setStatusById((prev) => ({ ...prev, [friend.user_id]: "sending" }));

        try {
            await inviteFriendToRoom(friend.user_id, code);
            setStatusById((prev) => ({ ...prev, [friend.user_id]: "sent" }));
        } catch {
            setStatusById((prev) => ({ ...prev, [friend.user_id]: "error" }));
        }
    }

    return (
        <div className={`lobby-invite ${open ? "is-open" : ""}`}>
            <button
                type="button"
                className="lobby-invite-toggle"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
            >
                <span className="lobby-invite-toggle-text">
                    <strong>Invitar amigos</strong>
                    <small>Les llega un mail con link y QR</small>
                </span>
                <span className="lobby-invite-chevron" aria-hidden="true">
                    ▾
                </span>
            </button>

            <div className="lobby-invite-drawer">
                <div className="lobby-invite-drawer-inner">
                    {loading ? (
                        <p className="lobby-invite-empty">Cargando amigos...</p>
                    ) : error ? (
                        <p className="lobby-invite-empty is-error">{error}</p>
                    ) : friends.length === 0 ? (
                        <p className="lobby-invite-empty">
                            Todavia no tenes amigos agregados.
                        </p>
                    ) : (
                        <ul className="lobby-invite-list">
                            {friends.map((friend) => {
                                const status = statusById[friend.user_id];
                                return (
                                    <li
                                        key={friend.user_id}
                                        className="lobby-invite-item"
                                    >
                                        <div className="lobby-invite-user">
                                            <span className="lobby-invite-avatar">
                                                {(friend.username || "?")
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </span>
                                            <strong>{friend.username}</strong>
                                        </div>
                                        <button
                                            type="button"
                                            className={`lobby-invite-button ${
                                                status === "sent" ? "is-sent" : ""
                                            }`}
                                            onClick={() => handleInvite(friend)}
                                            disabled={
                                                status === "sending" ||
                                                status === "sent"
                                            }
                                        >
                                            {status === "sending"
                                                ? "Enviando..."
                                                : status === "sent"
                                                    ? "Invitado ✓"
                                                    : status === "error"
                                                        ? "Reintentar"
                                                        : "Invitar"}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

export default LobbyInvitePanel;
