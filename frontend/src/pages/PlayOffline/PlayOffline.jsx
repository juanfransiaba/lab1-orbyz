import { useNavigate } from "react-router-dom";
import logo from "../../assets/images/logo.png";
import "./PlayOffline.css";

const OFFLINE_MODES = [
    {
        id: "country-by-capital",
        title: "Adivinar país por capital",
        description:
            "Identificá el país correcto a partir de su capital y entrená tu memoria geográfica.",
        route: "/offline/country-by-capital",
        imageAlt: "Imagen ilustrativa del modo adivinar país por capital",
    },
    {
        id: "capital-by-country",
        title: "Adivinar capital por país",
        description: "Descubrí si recordás las capitales del mundo.",
        route: "/offline/capital-by-country",
        imageAlt: "Imagen ilustrativa del modo adivinar capital por país",
    },
    {
        id: "country-by-shape",
        title: "Adivinar país por silueta",
        description:
            "Reconocé países por su forma y reforzá tu lectura visual del mapa.",
        route: "/offline/country-by-shape",
        imageAlt: "Imagen ilustrativa del modo adivinar país por silueta",
    },
    {
        id: "country-by-continent",
        title: "Adivinar país por continente",
        description: "Adiviná el país jugando en un continente específico.",
        route: "/offline/continent-selection",
        imageAlt: "Imagen ilustrativa del modo adivinar país por continente",
    },
];

function PlayOffline() {
    const navigate = useNavigate();

    return (
        <div className="play-offline-page">
            <header className="play-offline-header">
                <div className="play-offline-header-left">
                    <button
                        type="button"
                        className="play-offline-back-button"
                        onClick={() => navigate("/mainMenu")}
                    >
                        Volver
                    </button>
                </div>

                <div className="play-offline-header-center">
                    <img
                        src={logo}
                        alt="Logo ORBYZ"
                        className="play-offline-header-logo"
                    />
                    <h1>Modo Offline</h1>
                </div>

                <div className="play-offline-header-right" />
            </header>

            <main className="play-offline-main">
                <section className="play-offline-grid" aria-label="Modos offline disponibles">
                    {OFFLINE_MODES.map((mode) => (
                        <button
                            key={mode.id}
                            type="button"
                            className="play-offline-card"
                            onClick={() => navigate(mode.route)}
                        >
                            <div className="play-offline-card-image-wrap">
                                <div className="play-offline-card-image-placeholder">
                                    <span>Espacio para imagen</span>
                                </div>
                                <img
                                    src=""
                                    alt={mode.imageAlt}
                                    className="play-offline-card-image"
                                />
                            </div>

                            <div className="play-offline-card-content">
                                <span className="play-offline-card-tag">Modo offline</span>
                                <h3>{mode.title}</h3>
                                <p>{mode.description}</p>
                            </div>
                        </button>
                    ))}
                </section>
            </main>
        </div>
    );
}

export default PlayOffline;