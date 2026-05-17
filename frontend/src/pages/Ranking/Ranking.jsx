import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { abandonMatch, getMyMatches } from "../../services/MatchService.js";
import "./Ranking.css";

const STATUS_FILTERS = [
    { id: "", label: "Todas" },
    { id: "ongoing", label: "En curso" },
    { id: "completed", label: "Finalizadas" },
    { id: "abandoned", label: "Abandonadas" },
];

const STATUS_META = {
    ongoing: { label: "En curso", className: "is-ongoing" },
    completed: { label: "Finalizada", className: "is-completed" },
    abandoned: { label: "Abandonada", className: "is-abandoned" },
};

const MODE_LABELS = {
    "country-by-capital": "Pais por capital",
    "capital-by-country": "Capital por pais",
    "country-by-shape": "Pais por silueta",
    "country-by-continent": "Pais por continente",
};

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function getModeLabel(mode) {
    return MODE_LABELS[mode] || mode || "Modo desconocido";
}

function Ranking() {
    const location = useLocation();
    const isHistoryView = location.pathname === "/history";
    const [status, setStatus] = useState(isHistoryView ? "completed" : "");
    const [page, setPage] = useState(1);
    const [matches, setMatches] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 8,
        total: 0,
        totalPages: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [processingMatchId, setProcessingMatchId] = useState(null);

    useEffect(() => {
        setStatus(isHistoryView ? "completed" : "");
        setPage(1);
    }, [isHistoryView]);

    useEffect(() => {
        const loadMatches = async () => {
            setLoading(true);
            setError("");

            try {
                const response = await getMyMatches({
                    page,
                    limit: 8,
                    status,
                });

                setMatches(response.data);
                setPagination(response.pagination);
            } catch (err) {
                setError(err.message || "No se pudieron cargar las partidas.");
            } finally {
                setLoading(false);
            }
        };

        void loadMatches();
    }, [page, status]);

    async function handleAbandonMatch(matchId) {
        const confirmed = window.confirm(
            "Esta partida dejara de figurar como en curso. Queres descartarla?"
        );

        if (!confirmed) {
            return;
        }

        setProcessingMatchId(matchId);
        setError("");

        try {
            await abandonMatch(matchId);

            const response = await getMyMatches({
                page,
                limit: 8,
                status,
            });

            const shouldGoToPreviousPage =
                response.data.length === 0 && response.pagination.total > 0 && page > 1;

            if (shouldGoToPreviousPage) {
                setPage((currentPage) => Math.max(currentPage - 1, 1));
                return;
            }

            setMatches(response.data);
            setPagination(response.pagination);
        } catch (err) {
            setError(err.message || "No se pudo descartar la partida.");
        } finally {
            setProcessingMatchId(null);
        }
    }

    const summary = useMemo(() => {
        return matches.reduce(
            (accumulator, match) => {
                if (match.status === "ongoing") {
                    accumulator.ongoing += 1;
                }

                if (match.status === "completed") {
                    accumulator.completed += 1;
                }

                accumulator.bestScore = Math.max(
                    accumulator.bestScore,
                    Number(match.score) || 0
                );

                return accumulator;
            },
            {
                ongoing: 0,
                completed: 0,
                bestScore: 0,
            }
        );
    }, [matches]);

    const pageTitle = isHistoryView ? "Historial" : "Partidas";
    const pageSubtitle = isHistoryView
        ? "Consulta tus partidas finalizadas y revisa tu rendimiento reciente."
        : "Segui tus partidas en curso y tu actividad guardada en una sola vista.";

    return (
        <div className="ranking-page">
            <header className="ranking-header">
                <div className="ranking-header-glow" />

                <div className="ranking-header-actions">
                    <Link to="/profile" className="ranking-back-button">
                        Volver
                    </Link>
                </div>

                <div className="ranking-title-wrap">
                    <span className="ranking-title-kicker">Geography Game System</span>
                    <h1 className="ranking-title">{pageTitle}</h1>
                </div>

                <div className="ranking-header-spacer" />
            </header>

            <main className="ranking-main">
                <section className="ranking-hero">
                    <div className="ranking-hero-copy">
                        <span className="ranking-eyebrow">Actividad guardada</span>
                        <h2>{pageTitle} del jugador</h2>
                        <p>{pageSubtitle}</p>
                    </div>

                    <div className="ranking-hero-stats">
                        <article className="ranking-stat-card">
                            <span className="ranking-stat-label">Resultados</span>
                            <strong>{pagination.total}</strong>
                            <span className="ranking-stat-note">coincidencias para este filtro</span>
                        </article>

                        <article className="ranking-stat-card">
                            <span className="ranking-stat-label">En curso</span>
                            <strong>{summary.ongoing}</strong>
                            <span className="ranking-stat-note">en la pagina actual</span>
                        </article>

                        <article className="ranking-stat-card">
                            <span className="ranking-stat-label">Finalizadas</span>
                            <strong>{summary.completed}</strong>
                            <span className="ranking-stat-note">en la pagina actual</span>
                        </article>

                        <article className="ranking-stat-card">
                            <span className="ranking-stat-label">Mejor score</span>
                            <strong>{summary.bestScore}</strong>
                            <span className="ranking-stat-note">entre los registros visibles</span>
                        </article>
                    </div>
                </section>

                <section className="ranking-toolbar">
                    <div className="ranking-filters" role="tablist" aria-label="Filtros de partidas">
                        {STATUS_FILTERS.map((filter) => (
                            <button
                                key={filter.id || "all"}
                                type="button"
                                className={`ranking-filter-button ${
                                    status === filter.id ? "is-active" : ""
                                }`}
                                onClick={() => {
                                    setStatus(filter.id);
                                    setPage(1);
                                }}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>

                    <div className="ranking-page-indicator">
                        Pagina {pagination.page} de {pagination.totalPages || 1}
                    </div>
                </section>

                <section className="ranking-panel">
                    {loading ? (
                        <div className="ranking-empty-state">Cargando partidas...</div>
                    ) : error ? (
                        <div className="ranking-empty-state is-error">{error}</div>
                    ) : matches.length === 0 ? (
                        <div className="ranking-empty-state">
                            Todavia no hay partidas guardadas para este filtro.
                        </div>
                    ) : (
                        <div className="ranking-list">
                            {matches.map((match) => {
                                const statusMeta =
                                    STATUS_META[match.status] || STATUS_META.ongoing;
                                const isProcessing = processingMatchId === match.id;

                                return (
                                    <article className="ranking-match-card" key={match.id}>
                                        <div className="ranking-match-head">
                                            <div>
                                                <span className="ranking-match-mode">
                                                    {getModeLabel(match.mode)}
                                                </span>
                                                <h3>
                                                    {match.continent
                                                        ? `${match.continent}`
                                                        : "Partida general"}
                                                </h3>
                                            </div>

                                            <span
                                                className={`ranking-status-badge ${statusMeta.className}`}
                                            >
                                                {statusMeta.label}
                                            </span>
                                        </div>

                                        {match.status === "ongoing" && (
                                            <div className="ranking-match-actions">
                                                <button
                                                    type="button"
                                                    className="ranking-inline-danger-button"
                                                    onClick={() => handleAbandonMatch(match.id)}
                                                    disabled={isProcessing}
                                                >
                                                    {isProcessing
                                                        ? "Descartando..."
                                                        : "Descartar partida"}
                                                </button>
                                            </div>
                                        )}

                                        <dl className="ranking-match-meta">
                                            <div>
                                                <dt>Score</dt>
                                                <dd>{match.score}</dd>
                                            </div>
                                            <div>
                                                <dt>Aciertos</dt>
                                                <dd>{match.correctCount}</dd>
                                            </div>
                                            <div>
                                                <dt>Errores</dt>
                                                <dd>{match.wrongCount}</dd>
                                            </div>
                                            <div>
                                                <dt>Ronda</dt>
                                                <dd>
                                                    {match.roundReached}
                                                    {match.totalRounds
                                                        ? ` / ${match.totalRounds}`
                                                        : ""}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt>Vidas</dt>
                                                <dd>{match.livesLeft}</dd>
                                            </div>
                                            <div>
                                                <dt>Inicio</dt>
                                                <dd>{formatDate(match.startedAt)}</dd>
                                            </div>
                                            <div>
                                                <dt>Ultima actividad</dt>
                                                <dd>{formatDate(match.updatedAt)}</dd>
                                            </div>
                                            <div>
                                                <dt>Fin</dt>
                                                <dd>{formatDate(match.finishedAt)}</dd>
                                            </div>
                                        </dl>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="ranking-pagination">
                    <button
                        type="button"
                        className="ranking-pagination-button"
                        onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
                        disabled={loading || page <= 1}
                    >
                        Anterior
                    </button>

                    <span className="ranking-pagination-summary">
                        Mostrando {matches.length} de {pagination.total} registros
                    </span>

                    <button
                        type="button"
                        className="ranking-pagination-button"
                        onClick={() =>
                            setPage((currentPage) =>
                                Math.min(currentPage + 1, pagination.totalPages || currentPage)
                            )
                        }
                        disabled={
                            loading ||
                            pagination.totalPages === 0 ||
                            page >= pagination.totalPages
                        }
                    >
                        Siguiente
                    </button>
                </section>
            </main>
        </div>
    );
}

export default Ranking;
