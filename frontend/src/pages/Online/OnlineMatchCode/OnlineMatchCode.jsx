import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { disconnectSocket, getSocket } from "../../../services/socket.js";
import {
    connectOnlineSocket,
    decodeToken,
    emitWithAck,
} from "../../../services/OnlineSocketService.js";
import { onChatMessage, sendChatMessage } from "../../../services/OnlineChatService.js";
import "../OnlineRoom.css";

const API_URL = import.meta.env.VITE_API_URL || "";

const LOBBY_BACKGROUND_IMAGES = [
    { src: "/images/paises/oman.jpg", position: "center 48%" },
    { src: "/images/paises/japan.jpg", position: "center 46%" },
    { src: "/images/paises/chile.jpg", position: "center 42%" },
    { src: "/images/paises/india.jpg", position: "center 48%" },
    { src: "/images/paises/noruega.jpg", position: "center 50%" },
    { src: "/images/paises/fiji.jpg", position: "center 54%" },
    { src: "/images/paises/peru.jpg", position: "center 44%" },
    { src: "/images/paises/rwanda.jpeg", position: "center 48%" },
    { src: "/images/paises/bahamas.jpg", position: "center 52%" },
    { src: "/images/paises/filipinas.jpg", position: "center 50%" },
    { src: "/images/paises/greece.jpg", position: "center 50%" },
    { src: "/images/paises/malta.jpg", position: "center 48%" },
    { src: "/images/paises/samoa.jpg", position: "center 54%" },
    { src: "/images/paises/santalucia.jpg", position: "center 54%" },
    { src: "/images/paises/sanmarino.jpg", position: "center 46%" },
];

function normalizePlayer(player = {}) {
    return {
        userId: player.userId,
        username: player.username || "Jugador",
        correctCount: player.correctCount ?? 0,
        wrongCount: player.wrongCount ?? 0,
        lives: player.lives ?? 3,
        currentIndex: player.currentIndex ?? 0,
        finished: player.finished ?? false,
        correctStreak: player.correctStreak ?? 0,
        powerups: {
            fiftyFifty: player.powerups?.fiftyFifty ?? 1,
            freeze: player.powerups?.freeze ?? 1,
        },
        frozenUntil: player.frozenUntil ?? 0,
        connected: player.connected ?? true,
    };
}

function playersFromRoom(room) {
    return Array.isArray(room?.players) ? room.players.map(normalizePlayer) : [];
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

function isLocalHost(hostname) {
    return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function getApiAssetBase() {
    if (!API_URL || typeof window === "undefined") {
        return API_URL;
    }

    try {
        const apiUrl = new URL(API_URL, window.location.origin);
        const pageUrl = new URL(window.location.href);

        if (isLocalHost(apiUrl.hostname) && !isLocalHost(pageUrl.hostname)) {
            apiUrl.hostname = pageUrl.hostname;
        }

        return apiUrl.origin;
    } catch {
        return API_URL;
    }
}

function resolveQuestionImage(src) {
    if (!src) {
        return "";
    }

    if (/^(https?:|data:|blob:)/.test(src)) {
        try {
            const imageUrl = new URL(src);

            if (imageUrl.pathname.startsWith("/images/")) {
                return `${imageUrl.pathname}${imageUrl.search}${imageUrl.hash}`;
            }

            if (
                typeof window !== "undefined" &&
                isLocalHost(imageUrl.hostname) &&
                !isLocalHost(window.location.hostname)
            ) {
                imageUrl.hostname = window.location.hostname;
            }

            return imageUrl.href;
        } catch {
            return src;
        }
    }

    if (src.startsWith("/images/")) {
        return src;
    }

    if (src.startsWith("/")) {
        return `${getApiAssetBase()}${src}`;
    }

    if (src.startsWith("static/")) {
        return `${getApiAssetBase()}/${src}`;
    }

    if (src.startsWith("images/")) {
        return `/${src}`;
    }

    return src;
}

function OnlineMatchCode() {
    const navigate = useNavigate();
    const location = useLocation();
    const initialRoom = location.state?.room || null;
    const tournamentReturnId = location.state?.tournamentId || null;
    const answerTimerRef = useRef(null);
    const tournamentRedirectRef = useRef(null);
    const [room, setRoom] = useState(() => initialRoom);
    const [phase, setPhase] = useState(() =>
        initialRoom?.status === "playing" ? "playing" : "lobby"
    );
    const [players, setPlayers] = useState(() => playersFromRoom(initialRoom));
    const [question, setQuestion] = useState(null);
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [matchEndsAt, setMatchEndsAt] = useState(0);
    const [now, setNow] = useState(Date.now());
    const [removedByQuestion, setRemovedByQuestion] = useState({});
    const [answerResult, setAnswerResult] = useState(null);
    const [gameResult, setGameResult] = useState(null);
    const [feedback, setFeedback] = useState("");
    const [messages, setMessages] = useState([]);
    const [chatText, setChatText] = useState("");
    const [chatError, setChatError] = useState("");
    const [lobbyChatOpen, setLobbyChatOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState("");
    const [copyFeedback, setCopyFeedback] = useState("");
    const currentUser = useMemo(
        () => decodeToken(localStorage.getItem("token") || ""),
        []
    );
    const currentUserId = currentUser?.user_id;

    const myProgress = players.find(
        (player) => Number(player.userId) === Number(currentUserId)
    );
    const rivalProgress = players.find(
        (player) => Number(player.userId) !== Number(currentUserId)
    );
    const isHost = Number(room?.hostUserId) === Number(currentUserId);
    const roomPlayers = players.length ? players : playersFromRoom(room);
    const canStart = isHost && roomPlayers.length >= 2 && room?.status === "waiting";
    const matchTimeLeft = matchEndsAt ? matchEndsAt - now : 0;
    const isFrozen = myProgress?.frozenUntil ? myProgress.frozenUntil > now : false;
    const frozenLeft = isFrozen ? myProgress.frozenUntil - now : 0;
    const currentRemovedIndices = question
        ? removedByQuestion[question.index] || []
        : [];
    const questionImage = resolveQuestionImage(question?.imageSrc);
    const gameFeedback = answerResult
        ? answerResult.correct
            ? "Correcto"
            : `Incorrecto. Era ${answerResult.correctValue}`
        : feedback;

    useEffect(() => {
        const intervalId = window.setInterval(() => setNow(Date.now()), 500);
        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        let active = true;
        const socket = getSocket();

        function handleRoomUpdate(updatedRoom) {
            setRoom(updatedRoom);
            setPlayers((currentPlayers) =>
                mergePlayers(currentPlayers, playersFromRoom(updatedRoom))
            );
        }

        function handleGameStarted(payload) {
            if (!active) {
                return;
            }

            setPhase("playing");
            setGameResult(null);
            setQuestion(payload.question);
            setTotalQuestions(payload.totalQuestions || 0);
            setMatchEndsAt(payload.matchEndsAt || 0);
            setAnswerResult(null);
            setRemovedByQuestion({});
            setRoom((currentRoom) =>
                currentRoom ? { ...currentRoom, status: "playing" } : currentRoom
            );
            setPlayers((currentPlayers) =>
                currentPlayers.map((player) =>
                    normalizePlayer({
                        ...player,
                        correctCount: 0,
                        wrongCount: 0,
                        lives: 3,
                        currentIndex: 0,
                        finished: false,
                        correctStreak: 0,
                        frozenUntil: 0,
                        powerups: { fiftyFifty: 1, freeze: 1 },
                    })
                )
            );
            setFeedback("");
        }

        function handleGameProgress(progress) {
            setPlayers((currentPlayers) =>
                mergePlayers(currentPlayers, [normalizePlayer(progress)])
            );
        }

        function handleGameOver(result) {
            setPhase("ended");
            setGameResult({ ...result, type: "game_over" });
            setQuestion(null);
            setPlayers((currentPlayers) =>
                mergePlayers(currentPlayers, (result.players || []).map(normalizePlayer))
            );
            setRoom((currentRoom) =>
                currentRoom ? { ...currentRoom, status: "finished" } : currentRoom
            );
        }

        function handleGameAbandoned(result) {
            setPhase("ended");
            setGameResult({ ...result, type: "abandoned" });
            setQuestion(null);
            setPlayers((currentPlayers) =>
                mergePlayers(currentPlayers, (result.players || []).map(normalizePlayer))
            );
            setFeedback("La partida termino por abandono.");
        }

        function handleGameReconnected(payload) {
            setRoom(payload.room);
            setPlayers((payload.players || []).map(normalizePlayer));
            setQuestion(payload.question);
            setTotalQuestions(payload.totalQuestions || 0);
            setMatchEndsAt(payload.matchEndsAt || 0);
            setMessages(payload.messages || []);
            setPhase(payload.room?.status === "playing" ? "playing" : "lobby");
            setFeedback("Reconectaste con la partida online.");
        }

        function handlePowerupAwarded(payload) {
            setPlayers((currentPlayers) =>
                currentPlayers.map((player) =>
                    Number(player.userId) === Number(payload.userId)
                        ? normalizePlayer({ ...player, lives: payload.lives })
                        : player
                )
            );

            if (Number(payload.userId) === Number(currentUserId)) {
                setFeedback("Ganaste una vida extra por racha.");
            }
        }

        function handlePlayerFrozen(payload) {
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

            if (Number(payload.userId) === Number(currentUserId)) {
                setFeedback("Tu pantalla quedo congelada por el rival.");
            }
        }

        function handleDisconnected(payload) {
            setPlayers((currentPlayers) =>
                currentPlayers.map((player) =>
                    Number(player.userId) === Number(payload.userId)
                        ? normalizePlayer({ ...player, connected: false })
                        : player
                )
            );
        }

        function handleReconnected(payload) {
            setPlayers((currentPlayers) =>
                currentPlayers.map((player) =>
                    Number(player.userId) === Number(payload.userId)
                        ? normalizePlayer({ ...player, connected: true })
                        : player
                )
            );
        }

        function handleSpectatorUpdate(payload) {
            setRoom((currentRoom) =>
                currentRoom
                    ? {
                          ...currentRoom,
                          spectatorCount: payload.spectatorCount ?? 0,
                      }
                    : currentRoom
            );
        }

        function handleTournamentMatchEnded(payload = {}) {
            const endedTournamentId = payload.tournamentId || tournamentReturnId;

            if (!tournamentReturnId || !endedTournamentId) {
                return;
            }

            if (Number(endedTournamentId) !== Number(tournamentReturnId)) {
                return;
            }

            if (tournamentRedirectRef.current) {
                return;
            }

            setFeedback("La partida del torneo termino. Volviendo a la llave...");

            tournamentRedirectRef.current = window.setTimeout(() => {
                emitWithAck("room:leave").catch(() => {});
                navigate("/tournaments", {
                    state: {
                        tournamentId: endedTournamentId,
                        feedback: "La llave del torneo se actualizo con el resultado.",
                    },
                });
            }, 900);
        }

        const unsubscribeChat = onChatMessage((message) => {
            setMessages((currentMessages) => [...currentMessages, message].slice(-50));
        });

        socket.on("room:update", handleRoomUpdate);
        socket.on("game:started", handleGameStarted);
        socket.on("game:progress", handleGameProgress);
        socket.on("game:over", handleGameOver);
        socket.on("game:abandoned", handleGameAbandoned);
        socket.on("game:reconnected", handleGameReconnected);
        socket.on("powerup:awarded", handlePowerupAwarded);
        socket.on("player:frozen", handlePlayerFrozen);
        socket.on("player:disconnected", handleDisconnected);
        socket.on("player:reconnected", handleReconnected);
        socket.on("spectator:update", handleSpectatorUpdate);
        socket.on("tournament:matchEnded", handleTournamentMatchEnded);

        connectOnlineSocket().catch((error) => {
            if (active) {
                setFeedback(error.message || "No se pudo conectar al servidor online.");
            }
        });

        return () => {
            active = false;
            unsubscribeChat();
            socket.off("room:update", handleRoomUpdate);
            socket.off("game:started", handleGameStarted);
            socket.off("game:progress", handleGameProgress);
            socket.off("game:over", handleGameOver);
            socket.off("game:abandoned", handleGameAbandoned);
            socket.off("game:reconnected", handleGameReconnected);
            socket.off("powerup:awarded", handlePowerupAwarded);
            socket.off("player:frozen", handlePlayerFrozen);
            socket.off("player:disconnected", handleDisconnected);
            socket.off("player:reconnected", handleReconnected);
            socket.off("spectator:update", handleSpectatorUpdate);
            socket.off("tournament:matchEnded", handleTournamentMatchEnded);

            if (answerTimerRef.current) {
                window.clearTimeout(answerTimerRef.current);
            }

            if (tournamentRedirectRef.current) {
                window.clearTimeout(tournamentRedirectRef.current);
            }
        };
    }, [currentUserId, navigate, tournamentReturnId]);

    async function handleStartGame() {
        setPendingAction("start");
        setFeedback("");

        try {
            await emitWithAck("game:start");
        } catch (error) {
            setFeedback(error.message || "No se pudo iniciar la partida.");
        } finally {
            setPendingAction("");
        }
    }

    async function handleLeave() {
        try {
            await emitWithAck("room:leave");
        } catch {
            // si ya no hay sala, igual salimos de la vista
        }

        disconnectSocket();
        navigate(tournamentReturnId ? "/tournaments" : "/online", {
            state: tournamentReturnId
                ? {
                      tournamentId: tournamentReturnId,
                  }
                : undefined,
        });
    }

    async function handleCopyRoomCode() {
        if (!room?.code) {
            return;
        }

        try {
            await navigator.clipboard.writeText(room.code);
            setCopyFeedback("Copiado");
            window.setTimeout(() => setCopyFeedback(""), 1400);
        } catch {
            setCopyFeedback("No se pudo copiar");
        }
    }

    function updateOwnProgress(response) {
        if (!currentUserId) {
            return;
        }

        setPlayers((currentPlayers) =>
            mergePlayers(currentPlayers, [
                {
                    userId: currentUserId,
                    correctCount: response.correctCount,
                    wrongCount: response.wrongCount,
                    lives: response.lives,
                    currentIndex: response.nextQuestion
                        ? response.nextQuestion.index
                        : (question?.index ?? 0) + 1,
                    finished: response.finished,
                    correctStreak: response.correctStreak,
                    powerups: myProgress?.powerups,
                    frozenUntil: myProgress?.frozenUntil ?? 0,
                },
            ])
        );
    }

    async function handleAnswer(option) {
        if (!question || answerResult || isFrozen) {
            return;
        }

        setPendingAction("answer");
        setFeedback("");

        try {
            const response = await emitWithAck("game:answer", {
                index: question.index,
                option,
            });

            setAnswerResult({
                selected: option,
                correct: response.correct,
                correctValue: response.correctValue,
                extraLife: response.extraLife,
            });
            updateOwnProgress(response);

            if (response.extraLife) {
                setFeedback("Racha completa: ganaste una vida extra.");
            }

            answerTimerRef.current = window.setTimeout(() => {
                setAnswerResult(null);
                setQuestion(response.nextQuestion);
                setRemovedByQuestion({});
            }, 950);
        } catch (error) {
            if (error.frozenUntil) {
                setPlayers((currentPlayers) =>
                    mergePlayers(currentPlayers, [
                        {
                            userId: currentUserId,
                            frozenUntil: error.frozenUntil,
                        },
                    ])
                );
            }

            setFeedback(error.message || "No se pudo responder.");
        } finally {
            setPendingAction("");
        }
    }

    async function handleUsePowerup(type) {
        if (!question || isFrozen) {
            return;
        }

        setPendingAction(type);
        setFeedback("");

        try {
            const response = await emitWithAck("game:usePowerup", { type });

            if (response.type === "fifty_fifty") {
                setRemovedByQuestion((currentRemoved) => ({
                    ...currentRemoved,
                    [response.questionIndex]: response.removedIndices || [],
                }));
                setFeedback("50/50 aplicado a la pregunta actual.");
            }

            if (response.type === "freeze") {
                setFeedback("Congelaste al rival por unos segundos.");
            }

            setPlayers((currentPlayers) =>
                mergePlayers(currentPlayers, [
                    {
                        userId: currentUserId,
                        powerups: response.powerups,
                    },
                ])
            );
        } catch (error) {
            setFeedback(error.message || "No se pudo usar el power-up.");
        } finally {
            setPendingAction("");
        }
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
        } catch (error) {
            setChatError(error.message || "No se pudo enviar el mensaje.");
        }
    }

    function renderPlayerCard(player, label) {
        const frozen = player?.frozenUntil > now;
        const streak = player?.correctStreak ?? 0;

        if (!player) {
            return (
                <article className="online-player-card is-waiting">
                    <div className="online-player-waiting">
                        <strong>Rival pendiente</strong>
                        <p>Comparte el codigo para que se una.</p>
                    </div>
                </article>
            );
        }

        return (
            <article className={`online-player-card ${frozen ? "is-frozen" : ""}`}>
                <div className="online-player-card-head">
                    <div className="online-player-avatar" aria-hidden="true">
                        {(player.username || "J").charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <span>{label}</span>
                        <strong>{player.username || "Jugador"}</strong>
                    </div>
                </div>
                <div className="online-player-metrics">
                    <span>{player.lives ?? "-"} vidas</span>
                    <span>{player.correctCount ?? 0} aciertos</span>
                    <span>racha {streak}/10</span>
                </div>
                {frozen && (
                    <div className="online-player-freeze">
                        Congelado {formatDuration(player.frozenUntil - now)}
                    </div>
                )}
            </article>
        );
    }

    function renderResultPlayerCard(player, label) {
        const isWinner =
            !gameResult?.draw &&
            Number(gameResult?.winnerUserId) === Number(player.userId);

        return (
            <article
                className={`online-result-player-card ${isWinner ? "is-winner" : ""}`}
            >
                <div className="online-result-player-head">
                    <div className="online-player-avatar" aria-hidden="true">
                        {(player.username || "J").charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <span>{label}</span>
                        <strong>{player.username || "Jugador"}</strong>
                    </div>
                    {isWinner && <em>Ganador</em>}
                </div>
                <div className="online-result-metrics">
                    <div>
                        <strong>{player.correctCount ?? 0}</strong>
                        <span>Aciertos</span>
                    </div>
                    <div>
                        <strong>{player.wrongCount ?? 0}</strong>
                        <span>Errores</span>
                    </div>
                    <div>
                        <strong>{player.lives ?? 0}</strong>
                        <span>Vidas</span>
                    </div>
                </div>
            </article>
        );
    }

    function renderPowerups() {
        return (
            <aside className="online-game-side-tools">
                <div className="online-game-spectators">
                    <span className="online-lobby-eye" aria-hidden="true" />
                    <strong>{room?.spectatorCount ?? 0}</strong>
                    <small>mirando</small>
                </div>

                <section className="online-powerups" aria-label="Habilidades especiales">
                    <button
                        type="button"
                        onClick={() => handleUsePowerup("fifty_fifty")}
                        disabled={
                            !question ||
                            isFrozen ||
                            (myProgress?.powerups?.fiftyFifty ?? 0) <= 0 ||
                            pendingAction === "fifty_fifty"
                        }
                    >
                        <span>50/50</span>
                        <strong>{myProgress?.powerups?.fiftyFifty ?? 0}</strong>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleUsePowerup("freeze")}
                        disabled={
                            !question ||
                            isFrozen ||
                            (myProgress?.powerups?.freeze ?? 0) <= 0 ||
                            pendingAction === "freeze"
                        }
                    >
                        <span>Freeze</span>
                        <strong>{myProgress?.powerups?.freeze ?? 0}</strong>
                    </button>
                </section>
            </aside>
        );
    }

    function renderChat() {
        return (
            <aside className="online-chat-panel">
                <div className="online-chat-head">
                    <div className="online-chat-icon" aria-hidden="true" />
                    <div>
                        <strong>Chat</strong>
                        <span>Sala {room?.code || "Sala"}</span>
                    </div>
                    <em>En vivo</em>
                </div>
                <div className="online-chat-messages">
                    {messages.length === 0 ? (
                        <div className="online-chat-empty">
                            <div className="online-chat-empty-icon" aria-hidden="true" />
                            <strong>Todavia no hay mensajes</strong>
                            <p>Se el primero en escribir y romper el hielo con tu rival.</p>
                        </div>
                    ) : (
                        messages.map((message, index) => {
                            const ownMessage =
                                Number(message.userId) === Number(currentUserId);
                            return (
                                <div
                                    className={`online-chat-message ${
                                        ownMessage ? "is-own" : ""
                                    }`}
                                    key={`${message.at}-${message.userId}-${index}`}
                                >
                                    <span>{message.username}</span>
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

    if (!room) {
        return (
            <div className="online-room-page">
                <header className="online-room-header">
                    <div className="online-room-header-glow" />
                    <button
                        type="button"
                        className="online-room-back-button"
                        onClick={() => navigate("/online")}
                    >
                        Volver
                    </button>
                    <div className="online-room-title-block">
                        <span>Modo online</span>
                        <h1>Sala</h1>
                    </div>
                    <span className="online-room-status">Sin sala</span>
                </header>
                <main className="online-room-main is-narrow">
                    <section className="online-room-panel">
                        <div className="online-room-panel-head">
                            <span>Sin sala activa</span>
                            <h2>Crea una partida o entra con codigo.</h2>
                        </div>
                        <button
                            type="button"
                            className="online-room-primary-button"
                            onClick={() => navigate("/online")}
                        >
                            Ir al modo online
                        </button>
                    </section>
                </main>
            </div>
        );
    }

    return (
        <div className={`online-room-page ${phase === "playing" ? "is-playing" : ""}`}>
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
                    <span>Sala {room.code}</span>
                    <h1>
                        {phase === "playing"
                            ? "Partida online"
                            : phase === "ended"
                              ? "Resultado online"
                              : "Lobby online"}
                    </h1>
                </div>
                <span className="online-room-status">
                    {phase === "playing"
                        ? formatDuration(matchTimeLeft)
                        : `${roomPlayers.length} / 2`}
                </span>
            </header>

            <main
                className={`online-room-main ${
                    phase === "playing" ? "is-game" : ""
                } ${phase === "lobby" ? "is-lobby" : ""} ${
                    phase === "ended" ? "is-ended" : ""
                }`}
            >
                {phase === "lobby" && (
                    <>
                        <div className="online-lobby-carousel" aria-hidden="true">
                            {LOBBY_BACKGROUND_IMAGES.map((image, index) => (
                                <span
                                    key={image.src}
                                    style={{
                                        backgroundImage: `url(${image.src})`,
                                        backgroundPosition: image.position,
                                        animationDelay: `${index * 5}s`,
                                    }}
                                />
                            ))}
                        </div>

                        <section className="online-lobby-layout">
                            <aside className="online-lobby-side-info">
                                <div className="online-lobby-code-box">
                                    <span>Codigo</span>
                                    <strong>{room.code}</strong>
                                    <button
                                        type="button"
                                        className="online-lobby-copy"
                                        onClick={handleCopyRoomCode}
                                    >
                                        {copyFeedback || "Copiar"}
                                    </button>
                                </div>

                                <div className="online-lobby-room-meta">
                                    <span>{roomPlayers.length} / 2</span>
                                    <small>jugadores</small>
                                </div>
                            </aside>

                            <div className="online-lobby-stage">
                                <div className="online-lobby-players">
                                    {renderPlayerCard(myProgress, "Tu jugador")}
                                    {renderPlayerCard(rivalProgress, "Rival")}
                                </div>

                                <div className="online-lobby-action-area">
                                    {isHost ? (
                                        <button
                                            type="button"
                                            className="online-room-primary-button"
                                            onClick={handleStartGame}
                                            disabled={!canStart || pendingAction === "start"}
                                        >
                                            {pendingAction === "start"
                                                ? "Iniciando..."
                                                : "Iniciar partida"}
                                        </button>
                                    ) : (
                                        <p className="online-room-feedback">
                                            Esperando que el anfitrion inicie la partida.
                                        </p>
                                    )}
                                    {feedback && (
                                        <p className="online-room-feedback is-error">
                                            {feedback}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                className={`online-lobby-chat-toggle ${
                                    lobbyChatOpen ? "is-open" : ""
                                }`}
                                onClick={() => setLobbyChatOpen((isOpen) => !isOpen)}
                                aria-expanded={lobbyChatOpen}
                            >
                                <span>Chat en vivo</span>
                                <strong>{messages.length}</strong>
                            </button>

                            <div
                                className={`online-lobby-chat-drawer ${
                                    lobbyChatOpen ? "is-open" : ""
                                }`}
                            >
                                <button
                                    type="button"
                                    className="online-lobby-chat-close"
                                    onClick={() => setLobbyChatOpen(false)}
                                >
                                    Cerrar chat
                                </button>
                                {renderChat()}
                            </div>
                        </section>
                    </>
                )}

                {phase === "playing" && (
                    <section className="online-game-layout">
                        {renderPowerups()}
                        <div className="online-game-main">
                            <div className="online-game-scoreboard">
                                {renderPlayerCard(myProgress, "Vos")}
                                {renderPlayerCard(rivalProgress, "Rival")}
                            </div>

                            <article
                                className={`online-question-card ${
                                    questionImage ? "has-image" : ""
                                }`}
                            >
                                {isFrozen && (
                                    <div className="online-freeze-alert">
                                        <strong>Freeze aplicado</strong>
                                        <span>
                                            Tu rival te congelo por{" "}
                                            {formatDuration(frozenLeft)}
                                        </span>
                                    </div>
                                )}
                                <div className="online-question-head">
                                    <span>
                                        Pregunta {(question?.index ?? 0) + 1} /{" "}
                                        {totalQuestions || "-"}
                                    </span>
                                    {isFrozen && (
                                        <strong>
                                            Congelado {formatDuration(frozenLeft)}
                                        </strong>
                                    )}
                                </div>

                                {question ? (
                                    <>
                                        <h2>{question.prompt}</h2>
                                        {questionImage && (
                                            <div
                                                className="online-question-image-frame"
                                                style={{
                                                    "--question-image": `url("${questionImage}")`,
                                                }}
                                            >
                                                <img
                                                    src={questionImage}
                                                    alt={question.imageAlt || "Pregunta"}
                                                    className="online-question-image"
                                                />
                                            </div>
                                        )}
                                        <div className="online-answer-grid">
                                            {question.options.map((option, index) => {
                                                const removed =
                                                    currentRemovedIndices.includes(index);
                                                const isCorrect =
                                                    answerResult?.correctValue === option;
                                                const isSelected =
                                                    answerResult?.selected === option;

                                                return (
                                                    <button
                                                        key={`${question.index}-${option}`}
                                                        type="button"
                                                        className={`online-answer-button ${
                                                            removed ? "is-removed" : ""
                                                        } ${
                                                            answerResult && isCorrect
                                                                ? "is-correct"
                                                                : ""
                                                        } ${
                                                            answerResult &&
                                                            isSelected &&
                                                            !answerResult.correct
                                                                ? "is-wrong"
                                                                : ""
                                                        }`}
                                                        onClick={() => handleAnswer(option)}
                                                        disabled={
                                                            removed ||
                                                            isFrozen ||
                                                            Boolean(answerResult) ||
                                                            pendingAction === "answer"
                                                        }
                                                    >
                                                        {option}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="online-question-empty">
                                        <span>Partida finalizada</span>
                                        <strong>Esperando al rival</strong>
                                        <p>
                                            Cuando el otro jugador termine, vas a ver el
                                            resultado final.
                                        </p>
                                    </div>
                                )}
                            </article>

                            <p
                                className={`online-room-feedback online-game-feedback ${
                                    gameFeedback ? "" : "is-empty"
                                } ${answerResult?.correct ? "is-success" : ""}`}
                            >
                                {gameFeedback || "Sin feedback"}
                            </p>
                        </div>

                        {renderChat()}
                    </section>
                )}

                {phase === "ended" && (
                    <section className="online-result-layout">
                        <div className="online-result-panel">
                            <div className="online-result-hero">
                                <div>
                                    <span>Resultado final</span>
                                    <h2>
                                        {gameResult?.type === "abandoned"
                                            ? "Partida abandonada"
                                            : gameResult?.draw
                                              ? "Empate"
                                              : Number(gameResult?.winnerUserId) ===
                                                  Number(currentUserId)
                                                ? "Ganaste"
                                                : "Perdiste"}
                                    </h2>
                                    <p>
                                        {gameResult?.draw
                                            ? "Los dos terminaron con el mismo puntaje."
                                            : "Resumen de la partida"}
                                    </p>
                                </div>
                                <strong>
                                    {gameResult?.type === "abandoned"
                                        ? "Abandono"
                                        : gameResult?.draw
                                          ? "Empate"
                                          : Number(gameResult?.winnerUserId) ===
                                              Number(currentUserId)
                                            ? "Victoria"
                                            : "Derrota"}
                                </strong>
                            </div>
                            <div className="online-result-players">
                                {players.map((player) =>
                                    renderResultPlayerCard(
                                        player,
                                        Number(player.userId) === Number(currentUserId)
                                            ? "Vos"
                                            : "Rival"
                                    )
                                )}
                            </div>
                            <button
                                type="button"
                                className="online-room-primary-button"
                                onClick={handleLeave}
                            >
                                {tournamentReturnId
                                    ? "Volver al torneo"
                                    : "Volver al modo online"}
                            </button>
                        </div>
                        <div className="online-result-chat-slot">{renderChat()}</div>
                    </section>
                )}
            </main>
        </div>
    );
}

export default OnlineMatchCode;
