import { Link } from "react-router-dom";
import tournamentHero from "../../assets/images/imagen4.jpg";
import duelImage from "../../assets/images/imagen7.jpg";
import regionsImage from "../../assets/images/imagen6.jpg";
import "./Tournaments.css";

const TOURNAMENTS = [
    {
        title: "Copa semanal",
        label: "Proximamente",
        image: tournamentHero,
        description: "Una tabla corta con partidas programadas y puntaje acumulado.",
    },
    {
        title: "Duelos rapidos",
        label: "1 vs 1",
        image: duelImage,
        description: "Cruces directos para competir contra otro jugador en salas online.",
    },
    {
        title: "Copa regiones",
        label: "Por continente",
        image: regionsImage,
        description: "Un torneo tematico con desafios separados por recorte geografico.",
    },
];

function Tournaments() {
    return (
        <div className="tournaments-page">
            <header className="tournaments-header">
                <div className="tournaments-header-glow" />

                <div className="tournaments-header-actions">
                    <Link to="/mainMenu" className="tournaments-back-button">
                        Volver
                    </Link>
                </div>

                <div className="tournaments-title-wrap">
                    <span className="tournaments-title-kicker">Geography Game System</span>
                    <h1 className="tournaments-title">Torneos</h1>
                </div>

                <div className="tournaments-header-spacer" />
            </header>

            <main className="tournaments-main">
                <section className="tournaments-hero">
                    <div className="tournaments-hero-copy">
                        <span className="tournaments-eyebrow">Competencia</span>
                        <h2>Eventos para competir por etapas</h2>
                        <p>
                            Esta seccion queda preparada para crear copas, llaves y desafios
                            especiales cuando el modo torneos este listo.
                        </p>
                    </div>
                </section>

                <section className="tournaments-grid" aria-label="Tipos de torneos">
                    {TOURNAMENTS.map((tournament) => (
                        <article className="tournament-card" key={tournament.title}>
                            <div className="tournament-card-image-wrap">
                                <img
                                    src={tournament.image}
                                    alt=""
                                    className="tournament-card-image"
                                />
                                <span>{tournament.label}</span>
                            </div>

                            <div className="tournament-card-copy">
                                <h3>{tournament.title}</h3>
                                <p>{tournament.description}</p>
                            </div>
                        </article>
                    ))}
                </section>
            </main>
        </div>
    );
}

export default Tournaments;
