import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { disconnectSocket } from "../../../services/socket.js";
import { connectOnlineSocket, emitWithAck } from "../../../services/OnlineSocketService.js";
import capitalImage from "../../../assets/images/imagen.jpg";
import countryImage from "../../../assets/images/imagen2.jpg";
import shapeImage from "../../../assets/images/imagen6.jpg";
import continentImage from "../../../assets/images/imagen7.jpg";
import "../OnlineRoom.css";

const MODE_OPTIONS = [
    {
        id: "country-by-capital",
        label: "Pais por capital",
        description: "Te mostramos una capital. Vos elegis el pais.",
        imageAlt: "Vista urbana para el modo pais por capital",
        imageSrc: capitalImage,
        toneClass: "online-room-mode-card--capital",
        tag: "Capitales",
    },
    {
        id: "capital-by-country",
        label: "Capital por pais",
        description: "Ves el pais y tenes que clavar la capital.",
        imageAlt: "Ciudad para el modo capital por pais",
        imageSrc: countryImage,
        toneClass: "online-room-mode-card--country",
        tag: "Memoria",
    },
    {
        id: "country-by-shape",
        label: "Pais por silueta",
        description: "Reconoce la forma antes que el nombre.",
        imageAlt: "Paisaje para el modo pais por silueta",
        imageSrc: shapeImage,
        toneClass: "online-room-mode-card--shape",
        tag: "Visual",
    },
    {
        id: "country-by-continent",
        label: "Pais por continente",
        description: "Elegis una region y jugas con ese recorte.",
        imageAlt: "Vista costera para el modo pais por continente",
        imageSrc: continentImage,
        toneClass: "online-room-mode-card--continent",
        tag: "Regiones",
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

            <main className="online-room-main is-create">
                <form
                    className="online-room-panel online-room-create-panel"
                    onSubmit={handleCreateRoom}
                >
                    <div className="online-room-panel-head">
                        <h2>Elegir modo de juego</h2>
                    </div>

                    <div className="online-room-mode-grid">
                        {MODE_OPTIONS.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                className={`online-room-mode-card ${option.toneClass} ${
                                    mode === option.id ? "is-selected" : ""
                                }`}
                                onClick={() => setMode(option.id)}
                            >
                                <div className="online-room-mode-card-image-wrap">
                                    <img
                                        src={option.imageSrc}
                                        alt={option.imageAlt}
                                        className="online-room-mode-card-image"
                                    />
                                    <div className="online-room-mode-card-image-overlay" />
                                    <span className="online-room-mode-card-tag">
                                        {option.tag}
                                    </span>
                                </div>

                                <div className="online-room-mode-card-content">
                                    <strong>{option.label}</strong>
                                    <small>{option.description}</small>
                                    <span>
                                        {mode === option.id
                                            ? "Seleccionado >"
                                            : "Seleccionar >"}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="online-room-create-footer">
                        {mode === "country-by-continent" && (
                            <label className="online-room-field">
                                <span>Continente</span>
                                <select
                                    value={continent}
                                    onChange={(event) =>
                                        setContinent(event.target.value)
                                    }
                                >
                                    {CONTINENTS.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}

                        {error && (
                            <p className="online-room-feedback is-error">{error}</p>
                        )}

                        <button
                            type="submit"
                            className="online-room-primary-button"
                            disabled={loading}
                        >
                            {loading ? "Creando sala..." : "Crear sala online"}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}

export default CreateOnlineMatch;
