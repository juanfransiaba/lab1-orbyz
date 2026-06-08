import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { disconnectSocket } from "../../../services/socket.js";
import { connectOnlineSocket, emitWithAck } from "../../../services/OnlineSocketService.js";
import "../OnlineRoom.css";

function JoinOnlineMatch() {
    const navigate = useNavigate();
    const [roomCode, setRoomCode] = useState("");
    const [loading, setLoading] = useState(false);
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

        try {
            await connectOnlineSocket();
            const response = await emitWithAck("room:join", {
                code: normalizedCode,
            });

            navigate("/online/match", {
                state: { room: response.room },
            });
        } catch (joinError) {
            setError(joinError.message || "No se pudo entrar a la sala.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="online-room-page">
            <header className="online-room-header">
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

            <main className="online-room-main is-narrow">
                <form className="online-room-panel" onSubmit={handleJoinRoom}>
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
                            onChange={(event) => setRoomCode(event.target.value)}
                            placeholder="A7K9P"
                        />
                    </label>

                    {error && <p className="online-room-feedback is-error">{error}</p>}

                    <button
                        type="submit"
                        className="online-room-primary-button"
                        disabled={loading || normalizedCode.length !== 5}
                    >
                        {loading ? "Entrando..." : "Unirse a sala"}
                    </button>
                </form>
            </main>
        </div>
    );
}

export default JoinOnlineMatch;
