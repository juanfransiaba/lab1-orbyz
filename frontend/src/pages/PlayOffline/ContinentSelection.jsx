import { useNavigate } from "react-router-dom";
import americaImage from "../../assets/images/imagen.jpg";
import europaImage from "../../assets/images/imagen2.jpg";
import asiaImage from "../../assets/images/imagen7.jpg";
import africaImage from "../../assets/images/imagen6.jpg";
import oceaniaImage from "../../assets/images/imagen4.jpg";
import "./ContinentSelection.css";

const CONTINENT_OPTIONS = [
    {
        id: "america",
        title: "America",
        description: "Recorre paises de norte a sur con partidas variadas y dinamicas.",
        route: "/offline/continent-selection/america",
        label: "Extenso",
        image: americaImage,
    },
    {
        id: "europa",
        title: "Europa",
        description: "Un mapa mas compacto para rondas agiles y nombres muy reconocibles.",
        route: "/offline/continent-selection/europa",
        label: "Clasico",
        image: europaImage,
    },
    {
        id: "asia",
        title: "Asia",
        description: "Mayor diversidad de paises y un reto geografico mas amplio.",
        route: "/offline/continent-selection/asia",
        label: "Desafiante",
        image: asiaImage,
    },
    {
        id: "africa",
        title: "Africa",
        description: "Ideal para practicar ubicacion, capitales y reconocimiento visual.",
        route: "/offline/continent-selection/africa",
        label: "Equilibrado",
        image: africaImage,
    },
    {
        id: "oceania",
        title: "Oceania",
        description: "Una seleccion mas acotada para partidas rapidas y precisas.",
        route: "/offline/continent-selection/oceania",
        label: "Rapido",
        image: oceaniaImage,
    },
];

function ContinentSelection() {
    const navigate = useNavigate();
    const topRow = CONTINENT_OPTIONS.slice(0, 3);
    const bottomRow = CONTINENT_OPTIONS.slice(3);

    return (
        <div className="continent-selection-page">
            <header className="continent-selection-header">
                <div className="continent-selection-header-glow" />

                <div className="continent-selection-header-actions">
                    <button
                        type="button"
                        className="continent-selection-back-button"
                        onClick={() => navigate("/offline")}
                    >
                        Volver
                    </button>
                </div>

                <div className="continent-selection-title-wrap">
                    <span className="continent-selection-title-kicker">
                        Geography Game System
                    </span>
                    <h1 className="continent-selection-title">Por continente</h1>
                </div>

                <div className="continent-selection-header-spacer" />
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
                                    <img
                                        src={continent.image}
                                        alt={continent.title}
                                        className="continent-selection-card-image"
                                    />
                                    <div className="continent-selection-card-image-overlay" />
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
                                    <img
                                        src={continent.image}
                                        alt={continent.title}
                                        className="continent-selection-card-image"
                                    />
                                    <div className="continent-selection-card-image-overlay" />
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
