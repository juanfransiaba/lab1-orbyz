import { useNavigate } from "react-router-dom";
import logo from "../../assets/images/logo.png";
import capitalImage from "../../assets/images/imagen.jpg";
import countryImage from "../../assets/images/imagen2.jpg";
import shapeImage from "../../assets/images/imagen6.jpg";
import continentImage from "../../assets/images/imagen7.jpg";
import "./PlayOffline.css";

const OFFLINE_MODES = [
    {
        id: "country-by-capital",
        title: "Pais por capital",
        description: "Te mostramos una capital. Vos elegis el pais.",
        route: "/offline/country-by-capital",
        imageAlt: "Vista urbana para el modo pais por capital",
        imageSrc: capitalImage,
        toneClass: "play-offline-card--capital",
        tag: "Capitales",
    },
    {
        id: "capital-by-country",
        title: "Capital por pais",
        description: "Ves el pais y tenes que clavar la capital.",
        route: "/offline/capital-by-country",
        imageAlt: "Ciudad para el modo capital por pais",
        imageSrc: countryImage,
        toneClass: "play-offline-card--country",
        tag: "Memoria",
    },
    {
        id: "country-by-shape",
        title: "Pais por silueta",
        description: "Reconoce la forma antes que el nombre.",
        route: "/offline/country-by-shape",
        imageAlt: "Paisaje para el modo pais por silueta",
        imageSrc: shapeImage,
        toneClass: "play-offline-card--shape",
        tag: "Visual",
    },
    {
        id: "country-by-continent",
        title: "Pais por continente",
        description: "Elegis una region y jugas con ese recorte.",
        route: "/offline/continent-selection",
        imageAlt: "Vista costera para el modo pais por continente",
        imageSrc: continentImage,
        toneClass: "play-offline-card--continent",
        tag: "Regiones",
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
                <section
                    className="play-offline-grid"
                    aria-label="Modos offline disponibles"
                >
                    {OFFLINE_MODES.map((mode) => (
                        <button
                            key={mode.id}
                            type="button"
                            className={`play-offline-card ${mode.toneClass}`}
                            onClick={() => navigate(mode.route)}
                        >
                            <div className="play-offline-card-image-wrap">
                                {mode.imageSrc ? (
                                    <img
                                        src={mode.imageSrc}
                                        alt={mode.imageAlt}
                                        className="play-offline-card-image"
                                    />
                                ) : (
                                    <div className="play-offline-card-image-placeholder">
                                        <span>Mapa en preparacion</span>
                                    </div>
                                )}

                                <div className="play-offline-card-image-overlay" />

                                <span className="play-offline-card-tag">
                                    {mode.tag}
                                </span>
                            </div>

                            <div className="play-offline-card-content">
                                <h3>{mode.title}</h3>
                                <p>{mode.description}</p>
                                <span className="play-offline-card-link">
                                    Jugar
                                </span>
                            </div>
                        </button>
                    ))}
                </section>
            </main>
        </div>
    );
}

export default PlayOffline;
