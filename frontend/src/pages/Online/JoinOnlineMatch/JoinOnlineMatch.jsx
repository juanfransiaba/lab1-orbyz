import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { disconnectSocket } from "../../../services/socket.js";
import { connectOnlineSocket, emitWithAck } from "../../../services/OnlineSocketService.js";
import { joinAsSpectator } from "../../../services/OnlineSpectatorService.js";
import "../OnlineRoom.css";

const JOIN_BACKGROUND_IMAGES = [
    { src: "/images/paises/oman.jpg", position: "center 48%" },
    { src: "/images/paises/japan.jpg", position: "center 46%" },
    { src: "/images/paises/greece.jpg", position: "center 50%" },
    { src: "/images/paises/morocco.jpg", position: "center 52%" },
    { src: "/images/paises/australia.jpg", position: "center 48%" },
    { src: "/images/paises/italy.jpg", position: "center 46%" },
    { src: "/images/paises/canada.jpg", position: "center 44%" },
    { src: "/images/paises/turquia.jpg", position: "center 50%" },
    { src: "/images/paises/peru.jpg", position: "center 45%" },
    { src: "/images/paises/brasil.jpg", position: "center 52%" },
];

function canOfferSpectatorMode(message = "") {
    const normalizedMessage = message.toLowerCase();
    return (
        normalizedMessage.includes("empez") ||
        normalizedMessage.includes("llena") ||
        normalizedMessage.includes("torneo")
    );
}

function JoinOnlineMatch() {
    const navigate = useNavigate();
    const [roomCode, setRoomCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [spectatorLoading, setSpectatorLoading] = useState(false);
    const [spectatorAvailable, setSpectatorAvailable] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState("Conectando...");
    const [error, setError] = useState("");
    const normalizedCode = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, "");

    useEffect(() => {
        let active = true;

        connectOnlineSocket()
            .then(() => {
                if (active) {
                    setConnectionStatus("Online");
                }
            })
            .catch((connectionError) => {
                if (active) {
                    setConnectionStatus("Sin conexion");
                    setError(
                        connectionError.message ||
                            "No se pudo conectar al servidor online."
                    );
                }
            });

        return () => {
            active = false;
        };
    }, []);

    async function handleJoinRoom(event) {
        event.preventDefault();
        setLoading(true);
        setError("");
        setSpectatorAvailable(false);

        try {
            await connectOnlineSocket();
            const response = await emitWithAck("room:join", {
                code: normalizedCode,
            });

            navigate("/online/match", {
                state: { room: response.room },
            });
        } catch (joinError) {
            const message = joinError.message || "No se pudo entrar a la sala.";
            setError(message);
            setSpectatorAvailable(canOfferSpectatorMode(message));
        } finally {
            setLoading(false);
        }
    }

    async function handleSpectateRoom() {
        setSpectatorLoading(true);
        setError("");

        try {
            await connectOnlineSocket();
            const snapshot = await joinAsSpectator(normalizedCode);

            navigate("/online/spectate", {
                state: { snapshot, code: normalizedCode },
            });
        } catch (spectatorError) {
            setError(
                spectatorError.message || "No se pudo entrar como espectador."
            );
        } finally {
            setSpectatorLoading(false);
        }
    }

    return (
        <div className="online-room-page">
            <header className="online-room-header">
                <div className="online-room-header-glow" />
                <button
                    type="button"
                    className="online-room-back-button"
                    onClick={() => {
                        disconnectSocket();
                        navigate("/online");
                    }}
                >
                    Volver
                </button>
                <div className="online-room-title-block">
                    <span>Modo online</span>
                    <h1>Unirse a partida</h1>
                </div>
                <span className="online-room-status">{connectionStatus}</span>
            </header>

            <main className="online-room-main is-narrow is-join">
                <div className="online-join-carousel" aria-hidden="true">
                    {JOIN_BACKGROUND_IMAGES.map((image, index) => (
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

                <form
                    className="online-room-panel online-join-panel"
                    onSubmit={handleJoinRoom}
                >
                    <div className="online-room-panel-head">
                        <span>Codigo de sala</span>
                        <h2>Entrar con invitacion</h2>
                    </div>

                    <label className="online-room-field">
                        <span>Codigo</span>
                        <input
                            type="text"
                            value={normalizedCode}
                            maxLength={5}
                            onChange={(event) => {
                                setRoomCode(event.target.value);
                                setSpectatorAvailable(false);
                                setError("");
                            }}
                            placeholder="A7K9P"
                        />
                    </label>

                    {error && <p className="online-room-feedback is-error">{error}</p>}

                    {spectatorAvailable && (
                        <div className="online-room-spectator-offer">
                            <span>Sala disponible para mirar</span>
                            <button
                                type="button"
                                className="online-room-secondary-button"
                                onClick={handleSpectateRoom}
                                disabled={spectatorLoading || normalizedCode.length !== 5}
                            >
                                {spectatorLoading
                                    ? "Entrando como espectador..."
                                    : "Ver como espectador"}
                            </button>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="online-room-primary-button"
                        disabled={
                            loading ||
                            spectatorLoading ||
                            normalizedCode.length !== 5
                        }
                    >
                        {loading ? "Entrando..." : "Unirse a sala"}
                    </button>
                </form>
            </main>
        </div>
    );
}

export default JoinOnlineMatch;
