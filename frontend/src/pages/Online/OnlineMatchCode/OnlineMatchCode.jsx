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

function resolveQuestionImage(src) {
    if (!src) {
        return "";
    }

    if (/^(https?:|data:|blob:)/.test(src)) {
        return src;
    }

    if (src.startsWith("/")) {
        return `${API_URL}${src}`;
    }

    if (src.startsWith("static/")) {
        return `${API_URL}/${src}`;
    }

    return src;
}

function OnlineMatchCode() {
    const navigate = useNavigate();
    const location = useLocation();
    const initialRoom = location.state?.room || null;
    const answerTimerRef = useRef(null);
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
    const [pendingAction, setPendingAction] = useState("");
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

            if (answerTimerRef.current) {
                window.clearTimeout(answerTimerRef.current);
            }
        };
    }, [currentUserId]);

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
        navigate("/online");
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

        return (
            <article className={`online-player-card ${frozen ? "is-frozen" : ""}`}>
                <div className="online-player-card-head">
                    <span>{label}</span>
                    <strong>{player?.username || "Esperando..."}</strong>
                </div>
                <div className="online-player-metrics">
                    <span>{player?.lives ?? "-"} vidas</span>
                    <span>{player?.correctCount ?? 0} aciertos</span>
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

    function renderChat() {
        return (
            <aside className="online-chat-panel">
                <div className="online-chat-head">
                    <span>Chat</span>
                    <strong>{room?.code || "Sala"}</strong>
                </div>
                <div className="online-chat-messages">
                    {messages.length === 0 ? (
                        <p className="online-chat-empty">Todavia no hay mensajes.</p>
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
        <div className="online-room-page">
            <header className="online-room-header">
                <button
                    type="button"
                    className="online-room-back-button"
                    onClick={handleLeave}
                >
                    Salir
                </button>
                <div className="online-room-title-block">
                    <span>Sala {room.code}</span>
                    <h1>{phase === "playing" ? "Partida online" : "Lobby online"}</h1>
                </div>
                <span className="online-room-status">
                    {phase === "playing"
                        ? formatDuration(matchTimeLeft)
                        : `${roomPlayers.length} / 2`}
                </span>
            </header>

            <main className={`online-room-main ${phase === "playing" ? "is-game" : ""}`}>
                {phase === "lobby" && (
                    <section className="online-lobby-layout">
                        <div className="online-room-panel">
                            <div className="online-room-panel-head">
                                <span>Codigo de sala</span>
                                <h2>{room.code}</h2>
                            </div>
                            <div className="online-lobby-players">
                                {renderPlayerCard(myProgress, "Vos")}
                                {renderPlayerCard(rivalProgress, "Rival")}
                            </div>
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
                                <p className="online-room-feedback is-error">{feedback}</p>
                            )}
                        </div>
                        {renderChat()}
                    </section>
                )}

                {phase === "playing" && (
                    <section className="online-game-layout">
                        <div className="online-game-main">
                            <div className="online-game-scoreboard">
                                {renderPlayerCard(myProgress, "Vos")}
                                {renderPlayerCard(rivalProgress, "Rival")}
                            </div>

                            <article className="online-question-card">
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
                                        {questionImage && (
                                            <img
                                                src={questionImage}
                                                alt={question.imageAlt || "Pregunta"}
                                                className="online-question-image"
                                            />
                                        )}
                                        <h2>{question.prompt}</h2>
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
                                        Terminaste tus preguntas. Esperando resultado...
                                    </div>
                                )}
                            </article>

                            <section className="online-powerups">
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

                            {(feedback || answerResult) && (
                                <p
                                    className={`online-room-feedback ${
                                        answerResult?.correct ? "is-success" : ""
                                    }`}
                                >
                                    {answerResult
                                        ? answerResult.correct
                                            ? "Correcto"
                                            : `Incorrecto. Era ${answerResult.correctValue}`
                                        : feedback}
                                </p>
                            )}
                        </div>

                        {renderChat()}
                    </section>
                )}

                {phase === "ended" && (
                    <section className="online-lobby-layout">
                        <div className="online-room-panel">
                            <div className="online-room-panel-head">
                                <span>Resultado</span>
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
                            </div>
                            <div className="online-lobby-players">
                                {players.map((player) =>
                                    renderPlayerCard(
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
                                Volver al modo online
                            </button>
                        </div>
                        {renderChat()}
                    </section>
                )}
            </main>
        </div>
    );
}

export default OnlineMatchCode;
