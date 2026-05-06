import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    acceptFriendRequest,
    getFriends,
    getReceivedRequests,
    getSentRequests,
    rejectFriendRequest,
    removeFriendship,
    searchUsers,
    sendFriendRequest,
} from "../../../services/FriendService.js";
import "./Friends.css";

function extractArray(response, fallbackKeys = []) {
    if (Array.isArray(response)) {
        return response;
    }

    for (const key of fallbackKeys) {
        if (Array.isArray(response?.[key])) {
            return response[key];
        }
    }

    return [];
}

function normalizeUser(user) {
    return {
        userId: user?.user_id ?? user?.userId ?? user?.id ?? "",
        username: user?.username ?? user?.name ?? "Usuario",
        email: user?.email ?? "",
    };
}

function normalizeFriendEntry(entry) {
    return {
        friendshipId: entry?.friendship_id ?? entry?.friendshipId ?? entry?.id ?? "",
        userId: entry?.user_id ?? entry?.userId ?? entry?.id_user ?? "",
        username: entry?.username ?? entry?.user?.username ?? "Usuario",
        email: entry?.email ?? entry?.user?.email ?? "",
        score: entry?.score ?? entry?.user?.score ?? null,
        createdAt: entry?.created_at ?? entry?.createdAt ?? "",
    };
}

function getInitial(name) {
    return String(name || "U").charAt(0).toUpperCase();
}

function Friends() {
    const [searchValue, setSearchValue] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [friends, setFriends] = useState([]);
    const [receivedRequests, setReceivedRequests] = useState([]);
    const [sentRequests, setSentRequests] = useState([]);

    const [initialLoading, setInitialLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [sendingToId, setSendingToId] = useState(null);
    const [processingFriendshipId, setProcessingFriendshipId] = useState(null);

    const [feedback, setFeedback] = useState("");
    const [feedbackTone, setFeedbackTone] = useState("neutral");

    const friendIds = useMemo(
        () => new Set(friends.map((friend) => String(friend.userId))),
        [friends]
    );

    const sentRequestUserIds = useMemo(
        () => new Set(sentRequests.map((request) => String(request.userId))),
        [sentRequests]
    );

    const loadFriendsData = async () => {
        const [friendsResponse, receivedResponse, sentResponse] = await Promise.all([
            getFriends(),
            getReceivedRequests(),
            getSentRequests(),
        ]);

        setFriends(extractArray(friendsResponse).map(normalizeFriendEntry));
        setReceivedRequests(extractArray(receivedResponse).map(normalizeFriendEntry));
        setSentRequests(extractArray(sentResponse).map(normalizeFriendEntry));
    };

    useEffect(() => {
        const init = async () => {
            try {
                await loadFriendsData();
            } catch (error) {
                setFeedback(error.message || "No se pudo cargar la seccion de amigos.");
                setFeedbackTone("error");
            } finally {
                setInitialLoading(false);
            }
        };

        void init();
    }, []);

    async function handleSearchSubmit(event) {
        event.preventDefault();

        const trimmedValue = searchValue.trim();

        if (!trimmedValue) {
            setFeedback("Ingresá un nombre o correo para buscar usuarios.");
            setFeedbackTone("error");
            setSearchResults([]);
            return;
        }

        setSearching(true);
        setFeedback("");

        try {
            const response = await searchUsers(trimmedValue);
            const results = extractArray(response, ["users", "results", "data"])
                .map(normalizeUser)
                .filter((user) => user.userId);

            setSearchResults(results);

            if (results.length === 0) {
                setFeedback("No encontramos usuarios con esa busqueda.");
                setFeedbackTone("neutral");
            } else {
                setFeedback(`Se encontraron ${results.length} usuario(s).`);
                setFeedbackTone("success");
            }
        } catch (error) {
            setSearchResults([]);
            setFeedback(error.message || "No se pudo realizar la busqueda.");
            setFeedbackTone("error");
        } finally {
            setSearching(false);
        }
    }

    async function handleSendRequest(user) {
        setSendingToId(user.userId);
        setFeedback("");

        try {
            await sendFriendRequest(user.userId);
            await loadFriendsData();

            setFeedback(`Solicitud enviada a ${user.username}.`);
            setFeedbackTone("success");
        } catch (error) {
            setFeedback(error.message || "No se pudo enviar la solicitud.");
            setFeedbackTone("error");
        } finally {
            setSendingToId(null);
        }
    }

    async function handleAcceptRequest(request) {
        setProcessingFriendshipId(request.friendshipId);
        setFeedback("");

        try {
            await acceptFriendRequest(request.friendshipId);
            await loadFriendsData();

            setFeedback(`Ahora sos amigo de ${request.username}.`);
            setFeedbackTone("success");
        } catch (error) {
            setFeedback(error.message || "No se pudo aceptar la solicitud.");
            setFeedbackTone("error");
        } finally {
            setProcessingFriendshipId(null);
        }
    }

    async function handleRejectRequest(request) {
        setProcessingFriendshipId(request.friendshipId);
        setFeedback("");

        try {
            await rejectFriendRequest(request.friendshipId);
            await loadFriendsData();

            setFeedback(`Rechazaste la solicitud de ${request.username}.`);
            setFeedbackTone("neutral");
        } catch (error) {
            setFeedback(error.message || "No se pudo rechazar la solicitud.");
            setFeedbackTone("error");
        } finally {
            setProcessingFriendshipId(null);
        }
    }

    async function handleRemoveFriend(friend) {
        setProcessingFriendshipId(friend.friendshipId);
        setFeedback("");

        try {
            await removeFriendship(friend.friendshipId);
            await loadFriendsData();

            setFeedback(`Eliminaste a ${friend.username} de tus amigos.`);
            setFeedbackTone("neutral");
        } catch (error) {
            setFeedback(error.message || "No se pudo eliminar la amistad.");
            setFeedbackTone("error");
        } finally {
            setProcessingFriendshipId(null);
        }
    }

    return (
        <div className="friends-page">
            <header className="friends-header">
                <div className="friends-header-glow" />

                <div className="friends-header-actions">
                    <Link to="/profile" className="friends-back-button">
                        Volver
                    </Link>
                </div>

                <div className="friends-title-wrap">
                    <span className="friends-title-kicker">Geography Game System</span>
                    <h1 className="friends-title">Amigos</h1>
                </div>

                <div className="friends-header-spacer" />
            </header>

            <main className="friends-main">
                <section className="friends-panel friends-search-panel">
                    <div className="friends-panel-heading">
                        <div>
                            <p className="friends-panel-label">Comunidad</p>
                            <h2>Enviar solicitud de amistad</h2>
                            <p className="friends-panel-description">
                                Buscá jugadores por nombre o correo y mandales una solicitud
                                desde un solo panel.
                            </p>
                        </div>

                        <div className="friends-summary-chips">
                            <span className="friends-summary-chip">
                                {friends.length} amigo{friends.length === 1 ? "" : "s"}
                            </span>
                            <span className="friends-summary-chip">
                                {receivedRequests.length} pendiente
                                {receivedRequests.length === 1 ? "" : "s"}
                            </span>
                            <span className="friends-summary-chip">
                                {sentRequests.length} enviada
                                {sentRequests.length === 1 ? "" : "s"}
                            </span>
                        </div>
                    </div>

                    <form className="friends-search-form" onSubmit={handleSearchSubmit}>
                        <div className="friends-search-input-wrap">
                            <label htmlFor="friends-search" className="friends-search-label">
                                Buscar usuario
                            </label>
                            <input
                                id="friends-search"
                                type="text"
                                value={searchValue}
                                onChange={(event) => setSearchValue(event.target.value)}
                                placeholder="Nombre de usuario o correo"
                                className="friends-search-input"
                            />
                        </div>

                        <button
                            type="submit"
                            className="friends-primary-button"
                            disabled={searching}
                        >
                            {searching ? "Buscando..." : "Buscar"}
                        </button>
                    </form>

                    {feedback ? (
                        <div className={`friends-feedback is-${feedbackTone}`}>
                            {feedback}
                        </div>
                    ) : null}

                    {searchResults.length > 0 ? (
                        <div className="friends-results-list">
                            {searchResults.map((user) => {
                                const isAlreadyFriend = friendIds.has(String(user.userId));
                                const isPending = sentRequestUserIds.has(String(user.userId));
                                const isSending = sendingToId === user.userId;

                                return (
                                    <article className="friends-user-row" key={user.userId}>
                                        <div className="friends-user-main">
                                            <div className="friends-avatar">
                                                <span>{getInitial(user.username)}</span>
                                            </div>

                                            <div className="friends-user-copy">
                                                <h3>{user.username}</h3>
                                                <p>{user.email || "Sin correo visible"}</p>
                                            </div>
                                        </div>

                                        <div className="friends-user-actions">
                                            {isAlreadyFriend ? (
                                                <span className="friends-status-pill is-friend">
                                                    Ya son amigos
                                                </span>
                                            ) : isPending ? (
                                                <span className="friends-status-pill is-pending">
                                                    Solicitud enviada
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="friends-primary-button is-compact"
                                                    onClick={() => handleSendRequest(user)}
                                                    disabled={isSending}
                                                >
                                                    {isSending ? "Enviando..." : "Enviar"}
                                                </button>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    ) : null}

                    {sentRequests.length > 0 ? (
                        <div className="friends-sent-strip">
                            <p>Solicitudes enviadas</p>

                            <div className="friends-chip-list">
                                {sentRequests.map((request) => (
                                    <span className="friends-mini-chip" key={request.friendshipId}>
                                        {request.username}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </section>

                <section className="friends-grid">
                    <section className="friends-panel friends-column-panel">
                        <div className="friends-section-head">
                            <div>
                                <p className="friends-panel-label">Pendientes</p>
                                <h2>Solicitudes de amistad</h2>
                            </div>

                            <span className="friends-count-badge">
                                {receivedRequests.length}
                            </span>
                        </div>

                        {initialLoading ? (
                            <div className="friends-empty-state">Cargando solicitudes...</div>
                        ) : receivedRequests.length === 0 ? (
                            <div className="friends-empty-state">
                                No tenés solicitudes recibidas por ahora.
                            </div>
                        ) : (
                            <div className="friends-card-list">
                                {receivedRequests.map((request) => {
                                    const isProcessing =
                                        processingFriendshipId === request.friendshipId;

                                    return (
                                        <article
                                            className="friends-card-row"
                                            key={request.friendshipId}
                                        >
                                            <div className="friends-user-main">
                                                <div className="friends-avatar">
                                                    <span>{getInitial(request.username)}</span>
                                                </div>

                                                <div className="friends-user-copy">
                                                    <h3>{request.username}</h3>
                                                    <p>{request.email || "Sin correo visible"}</p>
                                                </div>
                                            </div>

                                            <div className="friends-action-group">
                                                <button
                                                    type="button"
                                                    className="friends-success-button"
                                                    onClick={() => handleAcceptRequest(request)}
                                                    disabled={isProcessing}
                                                >
                                                    {isProcessing ? "Procesando..." : "Aceptar"}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="friends-secondary-button"
                                                    onClick={() => handleRejectRequest(request)}
                                                    disabled={isProcessing}
                                                >
                                                    Rechazar
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section className="friends-panel friends-column-panel">
                        <div className="friends-section-head">
                            <div>
                                <p className="friends-panel-label">Red actual</p>
                                <h2>Mis amigos</h2>
                            </div>

                            <span className="friends-count-badge">{friends.length}</span>
                        </div>

                        {initialLoading ? (
                            <div className="friends-empty-state">Cargando amigos...</div>
                        ) : friends.length === 0 ? (
                            <div className="friends-empty-state">
                                Todavia no agregaste amigos. Podés empezar desde la búsqueda.
                            </div>
                        ) : (
                            <div className="friends-card-list">
                                {friends.map((friend) => {
                                    const isProcessing =
                                        processingFriendshipId === friend.friendshipId;

                                    return (
                                        <article
                                            className="friends-card-row"
                                            key={friend.friendshipId}
                                        >
                                            <div className="friends-user-main">
                                                <div className="friends-avatar">
                                                    <span>{getInitial(friend.username)}</span>
                                                </div>

                                                <div className="friends-user-copy">
                                                    <h3>{friend.username}</h3>
                                                    <p>{friend.email || "Sin correo visible"}</p>
                                                </div>
                                            </div>

                                            <div className="friends-user-side-meta">
                                                {typeof friend.score === "number" ? (
                                                    <span className="friends-score-pill">
                                                        Score {friend.score}
                                                    </span>
                                                ) : null}

                                                <button
                                                    type="button"
                                                    className="friends-danger-button"
                                                    onClick={() => handleRemoveFriend(friend)}
                                                    disabled={isProcessing}
                                                >
                                                    {isProcessing ? "Eliminando..." : "Eliminar"}
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </section>
            </main>
        </div>
    );
}

export default Friends;
