import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import NotificationBell from "../../components/NotificationBell.jsx";
import { getFriendsLeaderboard } from "../../services/LeaderboardService.js";
import "./Leaderboard.css";

const RANKING_COPY = {
    eyebrow: "Tu red",
    title: "Ranking de amigos",
    description: "Vos y tus amigos aceptados ordenados por puntos.",
};

function getInitials(username) {
    return String(username || "J")
        .trim()
        .charAt(0)
        .toUpperCase();
}

function Leaderboard() {
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadLeaderboard = async () => {
            setLoading(true);
            setError("");

            try {
                const leaderboardData = await getFriendsLeaderboard();
                setPlayers(leaderboardData);
            } catch (err) {
                setError(err.message || "No se pudo cargar el ranking.");
            } finally {
                setLoading(false);
            }
        };

        void loadLeaderboard();
    }, []);

    const currentPlayer = players.find((player) => player.isMe);

    const podium = players.slice(0, 3);
    const tablePlayers = players.slice(3);

    return (
        <div className="leaderboard-page">
            <header className="leaderboard-header">
                <div className="leaderboard-header-glow" />

                <div className="leaderboard-header-actions">
                    <Link to="/mainMenu" className="leaderboard-back-button">
                        Volver
                    </Link>
                </div>

                <div className="leaderboard-title-wrap">
                    <span className="leaderboard-title-kicker">Geography Game System</span>
                    <h1 className="leaderboard-title">Ranking</h1>
                </div>

                <div className="leaderboard-header-tools">
                    <NotificationBell />
                </div>
            </header>

            <main className="leaderboard-main">
                <section className="leaderboard-hero">
                    <div className="leaderboard-hero-copy">
                        <span className="leaderboard-eyebrow">{RANKING_COPY.eyebrow}</span>
                        <h2>{RANKING_COPY.title}</h2>
                        <p>{RANKING_COPY.description}</p>
                    </div>

                    <div className="leaderboard-player-summary">
                        <span>Tu posicion</span>
                        <strong>{currentPlayer ? `#${currentPlayer.rank}` : "-"}</strong>
                        <p>{currentPlayer?.username || "Usuario"}</p>
                    </div>
                </section>

                <section className="leaderboard-panel">
                    {loading ? (
                        <div className="leaderboard-empty-state">Cargando ranking...</div>
                    ) : error ? (
                        <div className="leaderboard-empty-state is-error">{error}</div>
                    ) : players.length === 0 ? (
                        <div className="leaderboard-empty-state">
                            Todavia no hay jugadores con puntaje en tu red.
                        </div>
                    ) : (
                        <>
                            <div className="leaderboard-podium" aria-label="Podio">
                                {podium.map((player) => (
                                    <article
                                        className={`leaderboard-podium-card rank-${player.rank} ${
                                            player.isMe ? "is-current-user" : ""
                                        }`}
                                        key={player.id}
                                    >
                                        <span className="leaderboard-rank">#{player.rank}</span>
                                        <div className="leaderboard-avatar">
                                            {getInitials(player.username)}
                                        </div>
                                        <h3>{player.username}</h3>
                                        <strong>{player.score}</strong>
                                        <span>puntos</span>
                                    </article>
                                ))}
                            </div>

                            <div className="leaderboard-table" aria-label="Ranking completo">
                                {tablePlayers.map((player) => {
                                    return (
                                        <article
                                            className={`leaderboard-row ${
                                                player.isMe ? "is-current-user" : ""
                                            }`}
                                            key={player.id}
                                        >
                                            <span className="leaderboard-row-rank">
                                                #{player.rank}
                                            </span>

                                            <div className="leaderboard-row-player">
                                                <div className="leaderboard-row-avatar">
                                                    {getInitials(player.username)}
                                                </div>
                                                <span>{player.username}</span>
                                            </div>

                                            <strong>{player.score}</strong>
                                        </article>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </section>
            </main>
        </div>
    );
}

export default Leaderboard;
