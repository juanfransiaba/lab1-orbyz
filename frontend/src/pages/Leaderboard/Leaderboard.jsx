import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import NotificationBell from "../../components/NotificationBell.jsx";
import {
    getCurrentProfile,
    getFriendsLeaderboard,
    getGlobalLeaderboard,
} from "../../services/LeaderboardService.js";
import "./Leaderboard.css";

const RANKING_TABS = [
    {
        id: "global",
        label: "Global",
        eyebrow: "Top 100",
        title: "Ranking global",
        description: "Los jugadores con mas puntos de todo ORBYZ.",
    },
    {
        id: "friends",
        label: "Amigos",
        eyebrow: "Tu red",
        title: "Ranking de amigos",
        description: "Vos y tus amigos aceptados ordenados por puntos.",
    },
];

function getInitials(username) {
    return String(username || "J")
        .trim()
        .charAt(0)
        .toUpperCase();
}

function Leaderboard() {
    const [activeTab, setActiveTab] = useState("global");
    const [players, setPlayers] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadLeaderboard = async () => {
            setLoading(true);
            setError("");

            try {
                const [leaderboardData, profileData] = await Promise.all([
                    activeTab === "friends"
                        ? getFriendsLeaderboard()
                        : getGlobalLeaderboard(),
                    getCurrentProfile(),
                ]);

                setPlayers(leaderboardData);
                setProfile(profileData);
            } catch (err) {
                setError(err.message || "No se pudo cargar el ranking.");
            } finally {
                setLoading(false);
            }
        };

        void loadLeaderboard();
    }, [activeTab]);

    const currentTab = RANKING_TABS.find((tab) => tab.id === activeTab) || RANKING_TABS[0];

    const currentPlayer = useMemo(() => {
        if (!profile) {
            return null;
        }

        return players.find(
            (player) => player.isMe || String(player.id) === String(profile.user_id)
        );
    }, [players, profile]);

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
                        <span className="leaderboard-eyebrow">{currentTab.eyebrow}</span>
                        <h2>{currentTab.title}</h2>
                        <p>{currentTab.description}</p>
                    </div>

                    <div className="leaderboard-player-summary">
                        <span>Tu posicion</span>
                        <strong>{currentPlayer ? `#${currentPlayer.rank}` : "-"}</strong>
                        <p>{profile?.username || "Usuario"}</p>
                    </div>
                </section>

                <section className="leaderboard-tabs" aria-label="Tipo de ranking">
                    {RANKING_TABS.map((tab) => (
                        <button
                            type="button"
                            key={tab.id}
                            className={activeTab === tab.id ? "is-active" : ""}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </section>

                <section className="leaderboard-panel">
                    {loading ? (
                        <div className="leaderboard-empty-state">Cargando ranking...</div>
                    ) : error ? (
                        <div className="leaderboard-empty-state is-error">{error}</div>
                    ) : players.length === 0 ? (
                        <div className="leaderboard-empty-state">
                            Todavia no hay jugadores con puntaje.
                        </div>
                    ) : (
                        <>
                            <div className="leaderboard-podium" aria-label="Podio">
                                {podium.map((player) => (
                                    <article
                                        className={`leaderboard-podium-card rank-${player.rank} ${
                                            player.isMe ||
                                            String(player.id) === String(profile?.user_id)
                                                ? "is-current-user"
                                                : ""
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
                                    const isCurrentUser =
                                        player.isMe ||
                                        (profile &&
                                            String(player.id) === String(profile.user_id));

                                    return (
                                        <article
                                            className={`leaderboard-row ${
                                                isCurrentUser ? "is-current-user" : ""
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
