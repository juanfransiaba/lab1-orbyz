import { useNavigate } from "react-router-dom";
import logo from "../../assets/images/logo.png";
import "./ContinentSelection.css";

const CONTINENT_OPTIONS = [
    {
        id: "america",
        title: "America",
        description: "Recorre paises de norte a sur con partidas variadas y dinamicas.",
        route: "/offline/continent-selection/america",
        label: "Extenso",
    },
    {
        id: "europa",
        title: "Europa",
        description: "Un mapa mas compacto para rondas agiles y nombres muy reconocibles.",
        route: "/offline/continent-selection/europa",
        label: "Clasico",
    },
    {
        id: "asia",
        title: "Asia",
        description: "Mayor diversidad de paises y un reto geografico mas amplio.",
        route: "/offline/continent-selection/asia",
        label: "Desafiante",
    },
    {
        id: "africa",
        title: "Africa",
        description: "Ideal para practicar ubicacion, capitales y reconocimiento visual.",
        route: "/offline/continent-selection/africa",
        label: "Equilibrado",
    },
    {
        id: "oceania",
        title: "Oceania",
        description: "Una seleccion mas acotada para partidas rapidas y precisas.",
        route: "/offline/continent-selection/oceania",
        label: "Rapido",
    },
];

function ContinentSelection() {
    const navigate = useNavigate();
    const topRow = CONTINENT_OPTIONS.slice(0, 3);
    const bottomRow = CONTINENT_OPTIONS.slice(3);

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
                    <h1>Por continente</h1>
                </div>

                <div className="continent-selection-header-right" />
            </header>

            <main className="continent-selection-main">
                <section
                    className="continent-selection-grid"
                    aria-label="Continentes disponibles"
                >
                    <div className="continent-selection-row-grid is-top-row">
                        {topRow.map((continent) => (
                            <button
                                key={continent.id}
                                type="button"
                                className="continent-selection-card"
                                onClick={() => navigate(continent.route)}
                            >
                                <div className="continent-selection-card-image-wrap">
                                    <div className="continent-selection-card-image-placeholder">
                                        <span>Espacio para imagen</span>
                                    </div>
                                </div>

                                <div className="continent-selection-card-content">
                                    <span className="continent-selection-card-label">
                                        {continent.label}
                                    </span>
                                    <h2>{continent.title}</h2>
                                    <p>{continent.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="continent-selection-row-grid is-bottom-row">
                        {bottomRow.map((continent) => (
                            <button
                                key={continent.id}
                                type="button"
                                className="continent-selection-card"
                                onClick={() => navigate(continent.route)}
                            >
                                <div className="continent-selection-card-image-wrap">
                                    <div className="continent-selection-card-image-placeholder">
                                        <span>Espacio para imagen</span>
                                    </div>
                                </div>

                                <div className="continent-selection-card-content">
                                    <span className="continent-selection-card-label">
                                        {continent.label}
                                    </span>
                                    <h2>{continent.title}</h2>
                                    <p>{continent.description}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}

export default ContinentSelection;
