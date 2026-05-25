import { useNavigate } from "react-router-dom";
import createImage from "../../../assets/images/imagen7.jpg";
import joinImage from "../../../assets/images/imagen3.jpg";
import "./OnlineMode.css";

const ONLINE_OPTIONS = [
    {
        id: "create",
        eyebrow: "Crear sala",
        title: "Crear partida online",
        description: "Genera una sala privada para invitar a otro jugador.",
        image: createImage,
        meta: [
            { label: "Sala", value: "Privada" },
            { label: "Rol", value: "Anfitrion" },
        ],
    },
    {
        id: "join",
        eyebrow: "Unirse",
        title: "Unirse a partida online",
        description: "Ingresa con el codigo que te compartieron.",
        image: joinImage,
        meta: [
            { label: "Acceso", value: "Codigo" },
            { label: "Rol", value: "Invitado" },
        ],
    },
];

function OnlineMode() {
    const navigate = useNavigate();

    return (
        <div className="online-mode-page">
            <header className="online-mode-header">
                <div className="online-mode-header-glow" />

                <div className="online-mode-header-actions">
                    <button
                        type="button"
                        className="online-mode-back-button"
                        onClick={() => navigate("/mainMenu")}
                    >
                        Volver
                    </button>
                </div>

                <div className="online-mode-title-wrap">
                    <span className="online-mode-title-kicker">
                        Geography Game System
                    </span>
                    <h1 className="online-mode-title">Modo Online</h1>
                </div>

                <div className="online-mode-header-spacer" />
            </header>

            <main className="online-mode-main">
                <section className="online-mode-options" aria-label="Opciones online">
                    {ONLINE_OPTIONS.map((option) => (
                        <article
                            key={option.id}
                            className={`online-mode-card online-mode-card--${option.id}`}
                        >
                            <img
                                src={option.image}
                                alt=""
                                className="online-mode-card-image"
                                aria-hidden="true"
                            />
                            <div className="online-mode-card-overlay" />

                            <div className="online-mode-card-content">
                                <span className="online-mode-card-eyebrow">
                                    {option.eyebrow}
                                </span>
                                <h2>{option.title}</h2>
                                <p>{option.description}</p>

                                <dl className="online-mode-card-meta">
                                    {option.meta.map((item) => (
                                        <div key={item.label}>
                                            <dt>{item.label}</dt>
                                            <dd>{item.value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        </article>
                    ))}
                </section>
            </main>
        </div>
    );
}

export default OnlineMode;
