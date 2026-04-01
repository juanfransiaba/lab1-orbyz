import { useNavigate } from "react-router-dom";
import logo from "../../assets/images/logo.png";
import "./ContinentSelection.css";

const CONTINENT_OPTIONS = [
    {
        id: "america",
        title: "América",
        description:
            "Jugá con países del continente americano y recorré desde el norte hasta el sur.",
        route: "/offline/continent-selection/america",
        imageAlt: "Imagen ilustrativa del continente América",
    },
    {
        id: "europa",
        title: "Europa",
        description:
            "Poné a prueba tus conocimientos con capitales, países y mapas del continente europeo.",
        route: "/offline/continent-selection/europa",
        imageAlt: "Imagen ilustrativa del continente Europa",
    },
    {
        id: "asia",
        title: "Asia",
        description:
            "Explorá una región enorme y diversa con desafíos centrados en geografía asiática.",
        route: "/offline/continent-selection/asia",
        imageAlt: "Imagen ilustrativa del continente Asia",
    },
    {
        id: "africa",
        title: "África",
        description:
            "Entrená tu memoria regional con países, capitales y referencias del continente africano.",
        route: "/offline/continent-selection/africa",
        imageAlt: "Imagen ilustrativa del continente África",
    },
    {
        id: "oceania",
        title: "Oceanía",
        description:
            "Elegí una partida enfocada en Oceanía y repasá sus países y ubicaciones más representativas.",
        route: "/offline/continent-selection/oceania",
        imageAlt: "Imagen ilustrativa del continente Oceanía",
    },
];

function ContinentSelection() {
    const navigate = useNavigate();

    return (
        <div className="continent-selection-page">
            <header className="continent-selection-header">
                <div className="continent-selection-header-left">
                    <button
                        type="button"
                        className="continent-selection-back-button"
                        onClick={() => navigate("/offline")}
                    >
                        Volver
                    </button>
                </div>

                <div className="continent-selection-header-center">
                    <img
                        src={logo}
                        alt="Logo ORBYZ"
                        className="continent-selection-header-logo"
                    />
                    <h1>Seleccionar continente</h1>
                </div>

                <div className="continent-selection-header-right" />
            </header>

            <main className="continent-selection-main">
                <section
                    className="continent-selection-grid"
                    aria-label="Continentes disponibles"
                >
                    {CONTINENT_OPTIONS.map((continent) => (
                        <button
                            key={continent.id}
                            type="button"
                            className={`continent-selection-card continent-selection-card-${continent.id}`}
                            onClick={() => navigate(continent.route)}
                        >
                            <div className="continent-selection-card-image-wrap">
                                <div className="continent-selection-card-image-placeholder">
                                    <span>Espacio para imagen</span>
                                </div>
                                <img
                                    src=""
                                    alt={continent.imageAlt}
                                    className="continent-selection-card-image"
                                />
                            </div>

                            <div className="continent-selection-card-content">
                                <span className="continent-selection-card-tag">
                                    Continente
                                </span>
                                <h3>{continent.title}</h3>
                                <p>{continent.description}</p>
                            </div>
                        </button>
                    ))}
                </section>
            </main>
        </div>
    );
}

export default ContinentSelection;