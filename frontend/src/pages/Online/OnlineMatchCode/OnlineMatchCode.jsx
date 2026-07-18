import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    ComposableMap,
    Geographies,
    Geography,
    ZoomableGroup,
    Marker,
} from "react-simple-maps";
import { geoCentroid, geoArea } from "d3-geo";
import { feature } from "topojson-client";
import { disconnectSocket, getSocket } from "../../../services/socket.js";
import {
    connectOnlineSocket,
    decodeToken,
    emitWithAck,
} from "../../../services/OnlineSocketService.js";
import { onChatMessage, sendChatMessage } from "../../../services/OnlineChatService.js";
import "../OnlineRoom.css";
import LobbyInvitePanel from "../LobbyInvitePanel/LobbyInvitePanel.jsx";
const SCREAMER_IMAGES = {
    screamer: "/images/paises/screamer.jpg",
    "screamer-2": "/images/paises/Screamer2.jpg",
};
const DEFAULT_SCREAMER_IMAGE_SRC = SCREAMER_IMAGES.screamer;

const API_URL = import.meta.env.VITE_API_URL || "";
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

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

function startScreamerSiren() {
    if (typeof window === "undefined") {
        return () => undefined;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
        return () => undefined;
    }

    let audioContext;

    try {
        audioContext = new AudioContextClass();
    } catch {
        return () => undefined;
    }

    const masterGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const lowOscillator = audioContext.createOscillator();
    const highOscillator = audioContext.createOscillator();
    const rumbleOscillator = audioContext.createOscillator();
    const lowGain = audioContext.createGain();
    const highGain = audioContext.createGain();
    const rumbleGain = audioContext.createGain();
    const tremolo = audioContext.createOscillator();
    const tremoloGain = audioContext.createGain();
    let highTone = false;
    let stopped = false;

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, audioContext.currentTime);
    filter.Q.setValueAtTime(7, audioContext.currentTime);

    lowOscillator.type = "sawtooth";
    highOscillator.type = "square";
    rumbleOscillator.type = "triangle";
    tremolo.type = "sine";

    lowOscillator.frequency.setValueAtTime(125, audioContext.currentTime);
    highOscillator.frequency.setValueAtTime(250, audioContext.currentTime);
    rumbleOscillator.frequency.setValueAtTime(54, audioContext.currentTime);
    tremolo.frequency.setValueAtTime(8.5, audioContext.currentTime);

    lowGain.gain.setValueAtTime(0.48, audioContext.currentTime);
    highGain.gain.setValueAtTime(0.16, audioContext.currentTime);
    rumbleGain.gain.setValueAtTime(0.12, audioContext.currentTime);
    tremoloGain.gain.setValueAtTime(0.055, audioContext.currentTime);
    masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.22, audioContext.currentTime + 0.08);

    lowOscillator.connect(lowGain);
    highOscillator.connect(highGain);
    rumbleOscillator.connect(rumbleGain);
    lowGain.connect(filter);
    highGain.connect(filter);
    rumbleGain.connect(filter);
    filter.connect(masterGain);
    tremolo.connect(tremoloGain);
    tremoloGain.connect(masterGain.gain);
    masterGain.connect(audioContext.destination);

    [lowOscillator, highOscillator, rumbleOscillator, tremolo].forEach((oscillator) =>
        oscillator.start()
    );

    if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => undefined);
    }

    const intervalId = window.setInterval(() => {
        highTone = !highTone;
        const targetTime = audioContext.currentTime;
        lowOscillator.frequency.cancelScheduledValues(targetTime);
        highOscillator.frequency.cancelScheduledValues(targetTime);
        filter.frequency.cancelScheduledValues(targetTime);
        lowOscillator.frequency.setTargetAtTime(highTone ? 390 : 125, targetTime, 0.12);
        highOscillator.frequency.setTargetAtTime(highTone ? 780 : 250, targetTime, 0.12);
        filter.frequency.setTargetAtTime(highTone ? 1500 : 720, targetTime, 0.14);
        masterGain.gain.setTargetAtTime(
            highTone ? 0.25 : 0.18,
            targetTime,
            0.08
        );
    }, 720);

    return () => {
        if (stopped) {
            return;
        }

        stopped = true;
        window.clearInterval(intervalId);

        try {
            masterGain.gain.cancelScheduledValues(audioContext.currentTime);
            masterGain.gain.setTargetAtTime(0.0001, audioContext.currentTime, 0.04);
            window.setTimeout(() => {
                [lowOscillator, highOscillator, rumbleOscillator, tremolo].forEach(
                    (oscillator) => {
                        try {
                            oscillator.stop();
                        } catch {
                            // El oscilador puede haberse detenido si React desmonta el efecto dos veces.
                        }
                    }
                );
                audioContext.close?.().catch(() => undefined);
            }, 180);
        } catch {
            audioContext.close?.().catch(() => undefined);
        }
    };
}

function resolveScreamerImageSrc(player = {}) {
    if (Object.values(SCREAMER_IMAGES).includes(player.screamerImageSrc)) {
        return player.screamerImageSrc;
    }

    return SCREAMER_IMAGES[player.screamerImageId] || DEFAULT_SCREAMER_IMAGE_SRC;
}

function normalizePlayer(player = {}) {
    return {
        userId: player.userId,
        username: player.username || "Jugador",
        avatar: player.avatar || null,
        correctCount: player.correctCount ?? 0,
        wrongCount: player.wrongCount ?? 0,
        lives: player.lives ?? 3,
        currentIndex: player.currentIndex ?? 0,
        finished: player.finished ?? false,
        correctStreak: player.correctStreak ?? 0,
        powerups: {
            fiftyFifty: player.powerups?.fiftyFifty ?? 1,
            freeze: player.powerups?.freeze ?? 1,
            screamer: player.powerups?.screamer ?? 0,
        },
        frozenUntil: player.frozenUntil ?? 0,
        screamerUntil: player.screamerUntil ?? 0,
        screamerImageId: player.screamerImageId ?? "screamer",
        screamerImageSrc: resolveScreamerImageSrc(player),
        connected: player.connected ?? true,
    };
}

function getPlayerAvatarLabel(player = {}) {
    return player.avatar?.icon || (player.username || "J").charAt(0).toUpperCase();
}

function renderPlayerAvatarContent(player = {}) {
    if (player.avatar?.imageSrc) {
        return <img src={player.avatar.imageSrc} alt="" />;
    }

    return <span>{getPlayerAvatarLabel(player)}</span>;
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

async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Try the textarea fallback below.
        }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";

    const selection = document.getSelection();
    const selectedRange =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        return document.execCommand("copy");
    } finally {
        document.body.removeChild(textarea);

        if (selection && selectedRange) {
            selection.removeAllRanges();
            selection.addRange(selectedRange);
        }
    }
}

function OnlineMapQuestion({ iso }) {
    const [view, setView] = useState({ center: [0, 8], zoom: 1 });

    useEffect(() => {
        let active = true;

        fetch(GEO_URL)
            .then((res) => res.json())
            .then((topo) => {
                if (!active) return;

                const features = feature(topo, topo.objects.countries).features;
                const target = features.find(
                    (geo) => Number(geo.id) === Number(iso)
                );

                if (!target) {
                    setView({ center: [0, 8], zoom: 1 });
                    return;
                }

                const center = geoCentroid(target);

                if (!Number.isFinite(center[0]) || !Number.isFinite(center[1])) {
                    setView({ center: [0, 8], zoom: 1 });
                    return;
                }

                // Usamos el AREA real del pais (no el rectangulo que lo contiene),
                // asi los paises con islas desperdigadas igual se detectan como chicos.
                const areaKm2 = geoArea(target) * 40.6e6; // geoArea viene en esteroradianes

                // Si el pais es mediano/grande se ve bien en el mapa mundial: sin zoom.
                const SMALL_COUNTRY_MAX_AREA_KM2 = 90000; // subilo/bajalo para ajustar
                if (areaKm2 >= SMALL_COUNTRY_MAX_AREA_KM2) {
                    setView({ center: [0, 8], zoom: 1 });
                    return;
                }

                // Pais chico: nos acercamos. Cuanto mas chico, mas zoom.
                const sizeDeg = Math.max(Math.sqrt(areaKm2) / 111, 0.15);
                const zoom = Math.min(Math.max(Math.round(13 / sizeDeg), 4), 9);

                setView({ center, zoom });
            })
            .catch(() => {
                if (active) setView({ center: [0, 8], zoom: 1 });
            });

        return () => {
            active = false;
        };
    }, [iso]);

    return (
        <div className="online-map-frame">
            <ComposableMap
                projection="geoEqualEarth"
                projectionConfig={{ scale: 150, center: [0, 8] }}
                width={900}
                height={420}
                className="online-map"
            >
                <ZoomableGroup
                    key={`${view.center[0]}-${view.center[1]}-${view.zoom}`}
                    center={view.center}
                    zoom={view.zoom}
                    minZoom={1}
                    maxZoom={16}
                >
                    <Geographies geography={GEO_URL}>
                        {({ geographies }) => {
                            const target = geographies.find(
                                (geo) => Number(geo.id) === Number(iso)
                            );
                            const targetCenter = target
                                ? geoCentroid(target)
                                : null;

                            return (
                                <>
                                    {geographies.map((geo) => {
                                        const isTarget =
                                            Number(geo.id) === Number(iso);
                                        const countryFill = isTarget
                                            ? "#22c55e"
                                            : "#f8fbff";
                                        const hoverFill = isTarget
                                            ? "#22c55e"
                                            : "#e7f0fb";

                                        return (
                                            <Geography
                                                key={geo.rsmKey}
                                                geography={geo}
                                                className={
                                                    isTarget ? "is-target" : ""
                                                }
                                                style={{
                                                    default: {
                                                        fill: countryFill,
                                                        stroke: "#8fa8c8",
                                                        strokeWidth: 0.42,
                                                        outline: "none",
                                                    },
                                                    hover: {
                                                        fill: hoverFill,
                                                        outline: "none",
                                                    },
                                                    pressed: {
                                                        fill: isTarget
                                                            ? "#16a34a"
                                                            : "#dbeafe",
                                                        outline: "none",
                                                    },
                                                }}
                                            />
                                        );
                                    })}

                                    {view.zoom > 1 && targetCenter && (
                                        <Marker coordinates={targetCenter}>
                                            <circle
                                                r={22 / view.zoom}
                                                fill="rgba(34, 197, 94, 0.28)"
                                                stroke="none"
                                            />
                                            <circle
                                                className="online-map-target-ring"
                                                r={22 / view.zoom}
                                                fill="none"
                                                stroke="#16a34a"
                                                strokeWidth={2.5 / view.zoom}
                                            />
                                        </Marker>
                                    )}
                                </>
                            );
                        }}
                    </Geographies>
                </ZoomableGroup>
            </ComposableMap>
        </div>
    );
}

function OnlineMatchCode() {
    const navigate = useNavigate();
    const location = useLocation();
    const initialRoom = location.state?.room || null;
    const tournamentReturnId = location.state?.tournamentId || null;
    const answerTimerRef = useRef(null);
    const tournamentRedirectRef = useRef(null);
    const screamerAudioRef = useRef(null);
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
    const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState("");
    const [copyFeedback, setCopyFeedback] = useState("");
    const [mapAnswer, setMapAnswer] = useState("");
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
    const roomPlayers = players.length ? players : playersFromRoom(room);
    const isTournamentRoom = Boolean(tournamentReturnId || room?.isTournament);
    const isRoomHost = Number(room?.hostUserId) === Number(currentUserId);
    const isWaitingRoom = room?.status === "waiting";
    const hasTwoPlayers = roomPlayers.length >= 2;
    const canStartCasualMatch = !isTournamentRoom && isRoomHost && isWaitingRoom;
    const matchTimeLeft = matchEndsAt ? matchEndsAt - now : 0;
    const isFrozen = myProgress?.frozenUntil ? myProgress.frozenUntil > now : false;
    const frozenLeft = isFrozen ? myProgress.frozenUntil - now : 0;
    const isScreamerActive = myProgress?.screamerUntil
        ? myProgress.screamerUntil > now
        : false;
    const screamerLeft = isScreamerActive ? myProgress.screamerUntil - now : 0;
    const currentScreamerImageSrc = resolveScreamerImageSrc(myProgress);
    const isPowerupBlocked = isFrozen || isScreamerActive;
    const currentRemovedIndices = question
        ? removedByQuestion[question.index] || []
        : [];
    const isMapQuestion =
        Boolean(question?.iso) || room?.mode === "country-by-map";
    const questionImage = resolveQuestionImage(question?.imageSrc);
    const isAbandonedResult = gameResult?.type === "abandoned";
    const abandonedByCurrentUser =
        isAbandonedResult &&
        Number(gameResult?.abandonerUserId) === Number(currentUserId);
    const abandonedByRival = isAbandonedResult && !abandonedByCurrentUser;
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
        if (!isScreamerActive) {
            if (screamerAudioRef.current) {
                screamerAudioRef.current();
                screamerAudioRef.current = null;
            }

            return undefined;
        }

        screamerAudioRef.current?.();
        screamerAudioRef.current = startScreamerSiren();

        return () => {
            screamerAudioRef.current?.();
            screamerAudioRef.current = null;
        };
    }, [isScreamerActive]);

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
            setMapAnswer("");
            setRoom((currentRoom) =>
                currentRoom ? { ...currentRoom, status: "playing" } : currentRoom
            );
            setPlayers((currentPlayers) => {
                if (Array.isArray(payload.players) && payload.players.length) {
                    return mergePlayers(
                        currentPlayers,
                        payload.players.map(normalizePlayer)
                    );
                }

                return currentPlayers.map((player) =>
                    normalizePlayer({
                        ...player,
                        correctCount: 0,
                        wrongCount: 0,
                        lives: 3,
                        currentIndex: 0,
                        finished: false,
                        correctStreak: 0,
                        frozenUntil: 0,
                        screamerUntil: 0,
                        powerups: { fiftyFifty: 1, freeze: 1, screamer: 0 },
                    })
                );
            });
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
            setLeaveConfirmOpen(false);
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
            setLeaveConfirmOpen(false);
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
            setMapAnswer("");
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

        function handlePlayerScreamed(payload) {
            setPlayers((currentPlayers) =>
                currentPlayers.map((player) =>
                    Number(player.userId) === Number(payload.userId)
                        ? normalizePlayer({
                              ...player,
                              screamerUntil: payload.screamerUntil,
                              screamerImageId: payload.screamerImageId,
                              screamerImageSrc: payload.screamerImageSrc,
                          })
                        : player
                )
            );

            if (Number(payload.userId) === Number(currentUserId)) {
                setFeedback("Tu rival uso SCREAMER.");
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
        socket.on("player:screamed", handlePlayerScreamed);
        socket.on("player:disconnected", handleDisconnected);
        socket.on("player:reconnected", handleReconnected);
        socket.on("spectator:update", handleSpectatorUpdate);
        socket.on("tournament:matchEnded", handleTournamentMatchEnded);

        connectOnlineSocket()
            .then(() => {
                if (active) {
                    socket.emit("room:sync");
                }
            })
            .catch((error) => {
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
            socket.off("player:screamed", handlePlayerScreamed);
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

    function handleLeave() {
        if (phase === "playing") {
            setLeaveConfirmOpen(true);
            return;
        }

        leaveRoom();
    }

    async function leaveRoom() {
        if (pendingAction === "leave") {
            return;
        }

        setPendingAction("leave");
        setLeaveConfirmOpen(false);

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

    function handleCancelLeave() {
        setLeaveConfirmOpen(false);
    }

    function handleConfirmLeave() {
        leaveRoom();
    }

    async function handleCopyRoomCode() {
        if (!room?.code) {
            return;
        }

        try {
            const copied = await copyTextToClipboard(room.code);

            if (!copied) {
                throw new Error("copy-failed");
            }

            setCopyFeedback("Copiado");
            window.setTimeout(() => setCopyFeedback(""), 1400);
        } catch {
            setCopyFeedback("No se pudo copiar");
            window.setTimeout(() => setCopyFeedback(""), 1800);
        }
    }

    async function handleStartGame() {
        if (!canStartCasualMatch || pendingAction === "start") {
            return;
        }

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
                    screamerUntil: myProgress?.screamerUntil ?? 0,
                    screamerImageId: myProgress?.screamerImageId,
                    screamerImageSrc: myProgress?.screamerImageSrc,
                },
            ])
        );
    }

    async function handleAnswer(option) {
        if (!question || answerResult || isPowerupBlocked) {
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
                setMapAnswer("");
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
            if (error.screamerUntil) {
                setPlayers((currentPlayers) =>
                    mergePlayers(currentPlayers, [
                        {
                            userId: currentUserId,
                            screamerUntil: error.screamerUntil,
                        },
                    ])
                );
            }

            setFeedback(error.message || "No se pudo responder.");
        } finally {
            setPendingAction("");
        }
    }

    async function handleMapAnswer(event) {
        event.preventDefault();
        const cleanAnswer = mapAnswer.trim();

        if (!cleanAnswer) {
            setFeedback("Escribi el nombre del pais en ingles.");
            return;
        }

        await handleAnswer(cleanAnswer);
    }

    async function handleUsePowerup(type) {
        if (!question || isPowerupBlocked) {
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

            if (response.type === "screamer") {
                setFeedback("SCREAMER enviado al rival.");
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
        const screamed = player?.screamerUntil > now;
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
            <article
                className={`online-player-card ${frozen ? "is-frozen" : ""} ${
                    screamed ? "is-screamed" : ""
                }`}
            >
                <div className="online-player-card-head">
                    <div className="online-player-avatar" aria-hidden="true">
                        {renderPlayerAvatarContent(player)}
                    </div>
                    <div>
                        <span>{label}</span>
                        <strong>{player.username || "Jugador"}</strong>
                    </div>
                </div>
                <div className="online-player-metrics">
                    <span>{player.correctCount ?? 0} aciertos</span>
                    <span>racha {streak}</span>
                </div>
                {frozen && (
                    <div className="online-player-freeze">
                        Congelado {formatDuration(player.frozenUntil - now)}
                    </div>
                )}
                {screamed && (
                    <div className="online-player-freeze online-player-screamer">
                        Screamer {formatDuration(player.screamerUntil - now)}
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
                        {renderPlayerAvatarContent(player)}
                    </div>
                    <div>
                        <span>{label}</span>
                        <strong>{player.username || "Jugador"}</strong>
                    </div>
                    {isWinner && <em>Ganador</em>}
                </div>
                <div
                    className={`online-result-metrics ${
                        isMapQuestion ? "is-time-mode" : ""
                    }`}
                >
                    <div>
                        <strong>{player.correctCount ?? 0}</strong>
                        <span>Aciertos</span>
                    </div>
                    <div>
                        <strong>{player.wrongCount ?? 0}</strong>
                        <span>Errores</span>
                    </div>
                    {!isMapQuestion && (
                        <div>
                            <strong>{player.lives ?? 0}</strong>
                            <span>Vidas</span>
                        </div>
                    )}
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
                    {!isMapQuestion && (
                        <button
                            type="button"
                            onClick={() => handleUsePowerup("fifty_fifty")}
                            disabled={
                                !question ||
                                isPowerupBlocked ||
                                (myProgress?.powerups?.fiftyFifty ?? 0) <= 0 ||
                                pendingAction === "fifty_fifty"
                            }
                        >
                            <span>50/50</span>
                            <strong>{myProgress?.powerups?.fiftyFifty ?? 0}</strong>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => handleUsePowerup("freeze")}
                        disabled={
                            !question ||
                            isPowerupBlocked ||
                            (myProgress?.powerups?.freeze ?? 0) <= 0 ||
                            pendingAction === "freeze"
                        }
                    >
                        <span>Freeze</span>
                        <strong>{myProgress?.powerups?.freeze ?? 0}</strong>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleUsePowerup("screamer")}
                        disabled={
                            !question ||
                            isPowerupBlocked ||
                            (myProgress?.powerups?.screamer ?? 0) <= 0 ||
                            pendingAction === "screamer"
                        }
                    >
                        <span>Screamer</span>
                        <strong>{myProgress?.powerups?.screamer ?? 0}</strong>
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
        <div
            className={`online-room-page ${
                phase === "playing" ? "is-playing" : ""
            } ${phase === "lobby" ? "is-lobby-page" : ""}`}
        >
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
                                {room?.code && <LobbyInvitePanel code={room.code} />}
                            </aside>

                            <div className="online-lobby-stage">
                                <div className="online-lobby-players">
                                    {renderPlayerCard(myProgress, "Tu jugador")}
                                    {renderPlayerCard(rivalProgress, "Rival")}
                                </div>

                                <div className="online-lobby-action-area">
                                    {canStartCasualMatch && (
                                        <button
                                            type="button"
                                            className="online-room-primary-button"
                                            onClick={handleStartGame}
                                            disabled={
                                                !hasTwoPlayers ||
                                                pendingAction === "start"
                                            }
                                        >
                                            {pendingAction === "start"
                                                ? "Iniciando..."
                                                : "Iniciar partida"}
                                        </button>
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
                                } ${isMapQuestion ? "has-map" : ""}`}
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
                                {isScreamerActive && (
                                    <div className="online-freeze-alert online-screamer-alert">
                                        <strong>SCREAMER</strong>
                                        <span>
                                            Pantalla bloqueada por{" "}
                                            {formatDuration(screamerLeft)}
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
                                        {isMapQuestion ? (
                                            <>
                                                <h2>¿Que pais esta marcado en el mapa?</h2>
                                                <OnlineMapQuestion iso={question.iso} />
                                                <form
                                                    className="online-map-answer-form"
                                                    onSubmit={handleMapAnswer}
                                                >
                                                    <input
                                                        value={mapAnswer}
                                                        onChange={(event) =>
                                                            setMapAnswer(
                                                                event.target.value
                                                            )
                                                        }
                                                        disabled={
                                                            isPowerupBlocked ||
                                                            Boolean(answerResult) ||
                                                            pendingAction === "answer"
                                                        }
                                                        placeholder="Escribi el pais en ingles"
                                                        autoComplete="off"
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={
                                                            isPowerupBlocked ||
                                                            Boolean(answerResult) ||
                                                            pendingAction === "answer"
                                                        }
                                                    >
                                                        Responder
                                                    </button>
                                                </form>
                                            </>
                                        ) : (
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
                                                            alt={
                                                                question.imageAlt ||
                                                                "Pregunta"
                                                            }
                                                            className="online-question-image"
                                                        />
                                                    </div>
                                                )}
                                                <div className="online-answer-grid">
                                                    {question.options.map(
                                                        (option, index) => {
                                                            const removed =
                                                                currentRemovedIndices.includes(
                                                                    index
                                                                );
                                                            const isCorrect =
                                                                answerResult?.correctValue ===
                                                                option;
                                                            const isSelected =
                                                                answerResult?.selected ===
                                                                option;

                                                            return (
                                                                <button
                                                                    key={`${question.index}-${option}`}
                                                                    type="button"
                                                                    className={`online-answer-button ${
                                                                        removed
                                                                            ? "is-removed"
                                                                            : ""
                                                                    } ${
                                                                        answerResult &&
                                                                        isCorrect
                                                                            ? "is-correct"
                                                                            : ""
                                                                    } ${
                                                                        answerResult &&
                                                                        isSelected &&
                                                                        !answerResult.correct
                                                                            ? "is-wrong"
                                                                            : ""
                                                                    }`}
                                                                    onClick={() =>
                                                                        handleAnswer(option)
                                                                    }
                                                                    disabled={
                                                                        removed ||
                                                                        isPowerupBlocked ||
                                                                        Boolean(
                                                                            answerResult
                                                                        ) ||
                                                                        pendingAction ===
                                                                            "answer"
                                                                    }
                                                                >
                                                                    {option}
                                                                </button>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            </>
                                        )}
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
                                        {abandonedByRival
                                            ? "El rival abandono la partida"
                                            : abandonedByCurrentUser
                                              ? "Abandonaste la partida"
                                            : gameResult?.draw
                                              ? "Empate"
                                              : Number(gameResult?.winnerUserId) ===
                                                  Number(currentUserId)
                                                ? "Ganaste"
                                                : "Perdiste"}
                                    </h2>
                                    <p>
                                        {abandonedByRival
                                            ? "La partida termino porque tu rival se fue."
                                            : abandonedByCurrentUser
                                              ? "Saliste de la partida online."
                                              : gameResult?.draw
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
                                {abandonedByRival
                                    ? "Salir"
                                    : tournamentReturnId
                                      ? "Volver al torneo"
                                      : "Volver al modo online"}
                            </button>
                        </div>
                        <div className="online-result-chat-slot">{renderChat()}</div>
                    </section>
                )}
            </main>

            {phase === "playing" && isScreamerActive && (
                <div className="online-screamer-overlay" role="alert" aria-live="assertive">
                    <div className="online-screamer-image-pulse">
                        <img src={currentScreamerImageSrc} alt="Screamer" />
                    </div>
                    <strong>SCREAMER</strong>
                    <span>{formatDuration(screamerLeft)}</span>
                </div>
            )}

            {leaveConfirmOpen && phase === "playing" && (
                <div className="online-leave-modal-backdrop" role="presentation">
                    <section
                        className="online-leave-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="online-leave-title"
                        aria-describedby="online-leave-description"
                    >
                        <div className="online-leave-modal-icon" aria-hidden="true">
                            !
                        </div>
                        <div className="online-leave-modal-copy">
                            <span>Partida en curso</span>
                            <h2 id="online-leave-title">Seguro que quieres salir?</h2>
                            <p id="online-leave-description">
                                Si abandonas ahora, tu rival gana la partida y se le
                                avisara que te fuiste.
                            </p>
                        </div>
                        <div className="online-leave-modal-actions">
                            <button
                                type="button"
                                className="online-leave-cancel-button"
                                onClick={handleCancelLeave}
                                disabled={pendingAction === "leave"}
                            >
                                Seguir jugando
                            </button>
                            <button
                                type="button"
                                className="online-leave-confirm-button"
                                onClick={handleConfirmLeave}
                                disabled={pendingAction === "leave"}
                            >
                                {pendingAction === "leave"
                                    ? "Saliendo..."
                                    : "Abandonar partida"}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

export default OnlineMatchCode;
