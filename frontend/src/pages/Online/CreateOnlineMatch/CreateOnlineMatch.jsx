import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { disconnectSocket } from "../../../services/socket.js";
import { connectOnlineSocket, emitWithAck } from "../../../services/OnlineSocketService.js";
import "../OnlineRoom.css";

const MODE_OPTIONS = [
    {
        id: "country-by-capital",
        label: "Pais por capital",
        description: "El server muestra una capital y se elige el pais.",
    },
    {
        id: "capital-by-country",
        label: "Capital por pais",
        description: "El server muestra un pais y se elige la capital.",
    },
    {
        id: "country-by-shape",
        label: "Pais por silueta",
        description: "Se juega con la silueta de cada pais.",
    },
    {
        id: "country-by-continent",
        label: "Pais por continente",
        description: "La partida usa solo paises del continente elegido.",
    },
];

const CONTINENTS = ["america", "europa", "asia", "africa", "oceania"];

function CreateOnlineMatch() {
    const navigate = useNavigate();
    const [mode, setMode] = useState("country-by-capital");
    const [continent, setContinent] = useState(CONTINENTS[0]);
    const [loading, setLoading] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState("Conectando...");
    const [error, setError] = useState("");

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

    async function handleCreateRoom(event) {
        event.preventDefault();
        setLoading(true);
        setError("");

        try {
            await connectOnlineSocket();

            const payload = {
                mode,
                ...(mode === "country-by-continent" ? { continent } : {}),
            };
            const response = await emitWithAck("room:create", payload);

            navigate("/online/match", {
                state: { room: response.room },
            });
        } catch (createError) {
            setError(createError.message || "No se pudo crear la sala.");
        } finally {
            setLoading(false);
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
                    <h1>Crear partida</h1>
                </div>
                <span className="online-room-status">{connectionStatus}</span>
            </header>

            <main className="online-room-main is-narrow">
                <form className="online-room-panel" onSubmit={handleCreateRoom}>
                    <div className="online-room-panel-head">
                        <span>Configuracion</span>
                        <h2>Elegir modo de juego</h2>
                    </div>

                    <div className="online-room-mode-grid">
                        {MODE_OPTIONS.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                className={`online-room-mode-card ${
                                    mode === option.id ? "is-selected" : ""
                                }`}
                                onClick={() => setMode(option.id)}
                            >
                                <strong>{option.label}</strong>
                                <small>{option.description}</small>
                            </button>
                        ))}
                    </div>

                    {mode === "country-by-continent" && (
                        <label className="online-room-field">
                            <span>Continente</span>
                            <select
                                value={continent}
                                onChange={(event) => setContinent(event.target.value)}
                            >
                                {CONTINENTS.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {error && <p className="online-room-feedback is-error">{error}</p>}

                    <button
                        type="submit"
                        className="online-room-primary-button"
                        disabled={loading}
                    >
                        {loading ? "Creando sala..." : "Crear sala online"}
                    </button>
                </form>
            </main>
        </div>
    );
}

export default CreateOnlineMatch;
