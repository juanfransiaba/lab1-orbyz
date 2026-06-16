import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { disconnectSocket } from "../../../services/socket.js";
import { onChatMessage, sendChatMessage } from "../../../services/OnlineChatService.js";
import { connectOnlineSocket, decodeToken } from "../../../services/OnlineSocketService.js";
import {
    joinAsSpectator,
    leaveSpectator,
    onGameAbandoned,
    onGameOver,
    onPlayerFrozen,
    onPowerupAwarded,
    onProgress,
    onSpectatorUpdate,
} from "../../../services/OnlineSpectatorService.js";
import "../OnlineRoom.css";

const MODE_LABELS = {
    "country-by-capital": "Pais por capital",
    "capital-by-country": "Capital por pais",
    "country-by-shape": "Pais por silueta",
    "country-by-continent": "Pais por continente",
    "country-by-map": "Pais en el mapa",
};

function normalizePlayer(player = {}) {
    return {
        userId: player.userId,
        username: player.username || "Jugador",
        correctCount: player.correctCount ?? 0,
        wrongCount: player.wrongCount ?? 0,
        lives: player.lives ?? 0,
        currentIndex: player.currentIndex ?? 0,
        finished: player.finished ?? false,
        correctStreak: player.correctStreak ?? 0,
        powerups: {
            fiftyFifty: player.powerups?.fiftyFifty ?? 0,
            freeze: player.powerups?.freeze ?? 0,
        },
        powerupsUsed: {
            fiftyFifty: player.powerupsUsed?.fiftyFifty ?? 0,
            freeze: player.powerupsUsed?.freeze ?? 0,
        },
        frozenUntil: player.frozenUntil ?? 0,
    };
}

function mergePlayers(currentPlayers, incomingPlayers) {
    const playersById = new Map();

    currentPlayers.forEach((player) => {
        if (player.userId !== undefined) {
            playersById.set(player.userId, normalizePlayer(player));
        }
    });

    incomingPlayers.forEach((player) => {
        if (player.userId !== undefined) {
            const previous = playersById.get(player.userId) || {};
            playersById.set(player.userId, normalizePlayer({ ...previous, ...player }));
        }
    });

    return Array.from(playersById.values());
}

function formatDuration(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function statusLabel(status) {
    if (status === "playing") {
        return "En vivo";
    }

    if (status === "finished") {
        return "Finalizada";
    }

    return "Esperando jugadores";
}

function OnlineSpectator() {
    const navigate = useNavigate();
    const location = useLocation();
    const initialSnapshot = location.state?.snapshot || null;
    const fallbackCode = location.state?.code || "";
    const [snapshot, setSnapshot] = useState(initialSnapshot);
    const [players, setPlayers] = useState(() =>
        (initialSnapshot?.players || []).map(normalizePlayer)
    );
    const [spectatorCount, setSpectatorCount] = useState(
        initialSnapshot?.spectatorCount ?? 0
    );
    const [matchEndsAt, setMatchEndsAt] = useState(initialSnapshot?.matchEndsAt || 0);
    const [phase, setPhase] = useState(initialSnapshot?.status || "waiting");
    const [messages, setMessages] = useState(initialSnapshot?.messages || []);
    const [chatText, setChatText] = useState("");
    const [chatError, setChatError] = useState("");
    const [activity, setActivity] = useState("Mirando la partida en tiempo real.");
    const [gameResult, setGameResult] = useState(null);
    const [error, setError] = useState("");
    const [now, setNow] = useState(() => Date.now());
    const currentUser = useMemo(
        () => decodeToken(localStorage.getItem("token") || ""),
        []
    );
    const currentUserId = currentUser?.user_id;
    const roomCode = snapshot?.code || fallbackCode;
    const totalQuestions = snapshot?.totalQuestions || 0;
    const matchTimeLeft = matchEndsAt && now ? matchEndsAt - now : 0;
    const modeName = MODE_LABELS[snapshot?.mode] || snapshot?.mode || "Modo online";

    useEffect(() => {
        const intervalId = window.setInterval(() => setNow(Date.now()), 500);
        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        let active = true;

        if (snapshot || !fallbackCode) {
            return () => {
                active = false;
            };
        }

        connectOnlineSocket()
            .then(() => joinAsSpectator(fallbackCode))
            .then((joinedSnapshot) => {
                if (!active) {
                    return;
                }

                setSnapshot(joinedSnapshot);
                setPlayers((joinedSnapshot.players || []).map(normalizePlayer));
                setSpectatorCount(joinedSnapshot.spectatorCount ?? 0);
                setMatchEndsAt(joinedSnapshot.matchEndsAt || 0);
                setPhase(joinedSnapshot.status || "waiting");
                setMessages(joinedSnapshot.messages || []);
            })
            .catch((joinError) => {
                if (active) {
                    setError(
                        joinError.message || "No se pudo entrar como espectador."
                    );
                }
            });

        return () => {
            active = false;
        };
    }, [fallbackCode, snapshot]);

    useEffect(() => {
        if (!snapshot) {
            return undefined;
        }

        const unsubscribers = [
            onProgress((progress) => {
                const normalized = normalizePlayer(progress);
                setPlayers((currentPlayers) =>
                    mergePlayers(currentPlayers, [normalized])
                );
                setActivity(`${normalized.username} actualizo su progreso.`);
            }),
            onPowerupAwarded((payload) => {
                setPlayers((currentPlayers) =>
                    currentPlayers.map((player) =>
                        Number(player.userId) === Number(payload.userId)
                            ? normalizePlayer({ ...player, lives: payload.lives })
                            : player
                    )
                );
                setActivity("Un jugador gano una vida extra por racha.");
            }),
            onPlayerFrozen((payload) => {
                setPlayers((currentPlayers) =>
                    currentPlayers.map((player) =>
                        Number(player.userId) === Number(payload.userId)
                            ? normalizePlayer({
                                  ...player,
                                  frozenUntil: payload.frozenUntil,
                              })
                            : player
                    )
                );
                setActivity("Freeze usado: un jugador quedo congelado.");
            }),
            onSpectatorUpdate((payload) => {
                setSpectatorCount(payload.spectatorCount ?? 0);
            }),
            onGameOver((result) => {
                setPhase("finished");
                setGameResult({ ...result, type: "game_over" });
                setPlayers((currentPlayers) =>
                    mergePlayers(
                        currentPlayers,
                        (result.players || []).map(normalizePlayer)
                    )
                );
                setActivity("La partida termino.");
            }),
            onGameAbandoned((result) => {
                setPhase("finished");
                setGameResult({ ...result, type: "abandoned" });
                setPlayers((currentPlayers) =>
                    mergePlayers(
                        currentPlayers,
                        (result.players || []).map(normalizePlayer)
                    )
                );
                setActivity("La partida termino por abandono.");
            }),
            onChatMessage((message) => {
                setMessages((currentMessages) =>
                    [...currentMessages, message].slice(-50)
                );
            }),
        ];

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [snapshot]);

    async function handleLeave() {
        try {
            await leaveSpectator();
        } catch {
            // si el server ya libero la sala, igual salimos de la vista
        }

        disconnectSocket();
        navigate("/online");
    }

    async function handleSendMessage(event) {
        event.preventDefault();

        if (!chatText.trim()) {
            return;
        }

        setChatError("");

        try {
            await sendChatMessage(chatText);
            setChatText("");
        } catch (sendError) {
            setChatError(sendError.message || "No se pudo enviar el mensaje.");
        }
    }

    function winnerText() {
        if (!gameResult) {
            return "";
        }

        if (gameResult.type === "abandoned") {
            const abandoner = players.find(
                (player) =>
                    Number(player.userId) === Number(gameResult.abandonerUserId)
            );
            return `${abandoner?.username || "Un jugador"} abandono la partida.`;
        }

        if (gameResult.draw) {
            return "Empate";
        }

        const winner = players.find(
            (player) => Number(player.userId) === Number(gameResult.winnerUserId)
        );
        return `Gano ${winner?.username || "un jugador"}`;
    }

    function renderPlayerCard(player, index) {
        const frozen = Boolean(now && player?.frozenUntil > now);
        const questionProgress = totalQuestions
            ? Math.min(100, ((player.currentIndex || 0) / totalQuestions) * 100)
            : 0;

        return (
            <article
                className={`online-spectator-player ${
                    frozen ? "is-frozen" : ""
                }`}
            >
                <div className="online-spectator-player-top">
                    <div>
                        <span>Jugador {index + 1}</span>
                        <strong>{player?.username || "Esperando..."}</strong>
                    </div>
                </div>

                <div className="online-spectator-progress">
                    <div
                        className="online-spectator-progress-bar"
                        style={{ "--progress": `${questionProgress}%` }}
                    />
                </div>

                <div className="online-spectator-metrics">
                    <div>
                        <span>Aciertos</span>
                        <strong>{player?.correctCount ?? 0}</strong>
                    </div>
                    <div>
                        <span>Errores</span>
                        <strong>{player?.wrongCount ?? 0}</strong>
                    </div>
                    <div>
                        <span>Pregunta</span>
                        <strong>
                            {player?.finished
                                ? "Fin"
                                : `${player?.currentIndex ?? 0} / ${
                                      totalQuestions || "-"
                                  }`}
                        </strong>
                    </div>
                    <div>
                        <span>Racha</span>
                        <strong>{player?.correctStreak ?? 0}</strong>
                    </div>
                </div>

                <div className="online-spectator-powerups">
                    <div>
                        <span>50/50 usados</span>
                        <strong>{player?.powerupsUsed?.fiftyFifty ?? 0}</strong>
                        <small>quedan {player?.powerups?.fiftyFifty ?? 0}</small>
                    </div>
                    <div>
                        <span>Freeze usados</span>
                        <strong>{player?.powerupsUsed?.freeze ?? 0}</strong>
                        <small>quedan {player?.powerups?.freeze ?? 0}</small>
                    </div>
                </div>

                {frozen && (
                    <div className="online-player-freeze">
                        Congelado {formatDuration(player.frozenUntil - now)}
                    </div>
                )}
            </article>
        );
    }

    function renderChat() {
        return (
            <aside className="online-chat-panel online-spectator-chat">
                <div className="online-chat-head">
                    <span>Chat</span>
                    <strong>{roomCode || "Sala"}</strong>
                </div>
                <div className="online-chat-messages">
                    {messages.length === 0 ? (
                        <p className="online-chat-empty">Todavia no hay mensajes.</p>
                    ) : (
                        messages.map((message, index) => {
                            const ownMessage =
                                Number(message.userId) === Number(currentUserId);
                            const spectatorMessage = message.role === "spectator";

                            return (
                                <div
                                    className={`online-chat-message ${
                                        ownMessage ? "is-own" : ""
                                    } ${spectatorMessage ? "is-spectator" : ""}`}
                                    key={`${message.at}-${message.userId}-${index}`}
                                >
                                    <span>
                                        {message.username}
                                        {spectatorMessage ? " - espectador" : ""}
                                    </span>
                                    <p>{message.text}</p>
                                </div>
                            );
                        })
                    )}
                </div>
                <form className="online-chat-form" onSubmit={handleSendMessage}>
                    <input
                        value={chatText}
                        maxLength={500}
                        onChange={(event) => setChatText(event.target.value)}
                        placeholder="Mensaje..."
                    />
                    <button type="submit">Enviar</button>
                </form>
                {chatError && <p className="online-room-feedback is-error">{chatError}</p>}
            </aside>
        );
    }

    if (!snapshot) {
        return (
            <div className="online-room-page">
                <header className="online-room-header">
                    <div className="online-room-header-glow" />
                    <button
                        type="button"
                        className="online-room-back-button"
                        onClick={() => navigate("/online/join")}
                    >
                        Volver
                    </button>
                    <div className="online-room-title-block">
                        <span>Modo online</span>
                        <h1>Espectador</h1>
                    </div>
                    <span className="online-room-status">Sin sala</span>
                </header>
                <main className="online-room-main is-narrow">
                    <section className="online-room-panel">
                        <div className="online-room-panel-head">
                            <span>Codigo requerido</span>
                            <h2>Entra desde Unirse a partida para mirar una sala.</h2>
                        </div>
                        {error && <p className="online-room-feedback is-error">{error}</p>}
                    </section>
                </main>
            </div>
        );
    }

    return (
        <div className="online-room-page">
            <header className="online-room-header">
                <div className="online-room-header-glow" />
                <button
                    type="button"
                    className="online-room-back-button"
                    onClick={handleLeave}
                >
                    Salir
                </button>
                <div className="online-room-title-block">
                    <span>Sala {roomCode}</span>
                    <h1>Modo espectador</h1>
                </div>
                <span className="online-room-status">
                    {phase === "playing" ? formatDuration(matchTimeLeft) : statusLabel(phase)}
                </span>
            </header>

            <main className="online-room-main is-game">
                <section className="online-spectator-layout">
                    <div className="online-game-main">
                        <section className="online-room-panel online-spectator-overview">
                            <div className="online-room-panel-head">
                                <span>{statusLabel(phase)}</span>
                                <h2>{winnerText() || "Mostrador de partida"}</h2>
                            </div>

                            <div className="online-spectator-summary">
                                <div>
                                    <span>Timer</span>
                                    <strong>
                                        {matchEndsAt
                                            ? formatDuration(matchTimeLeft)
                                            : "--:--"}
                                    </strong>
                                </div>
                                <div>
                                    <span>Espectadores</span>
                                    <strong>{spectatorCount}</strong>
                                </div>
                                <div>
                                    <span>Modo</span>
                                    <strong>{modeName}</strong>
                                </div>
                                <div>
                                    <span>Preguntas</span>
                                    <strong>{totalQuestions || "-"}</strong>
                                </div>
                            </div>

                            <p className="online-spectator-activity">{activity}</p>
                        </section>

                        <section className="online-spectator-scoreboard">
                            {players.length === 0 ? (
                                <div className="online-question-empty">
                                    Esperando jugadores para mostrar el marcador.
                                </div>
                            ) : (
                                players.map((player, index) => (
                                    <div key={player.userId || index}>
                                        {renderPlayerCard(player, index)}
                                    </div>
                                ))
                            )}
                        </section>
                    </div>

                    {renderChat()}
                </section>
            </main>
        </div>
    );
}

export default OnlineSpectator;
