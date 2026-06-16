import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    abandonMatch,
    getMyMatches,
    rememberResumeMatch,
} from "../../services/MatchService.js";
import "./Ranking.css";

const STATUS_FILTERS = [
    { id: "", label: "Todas" },
    { id: "ongoing", label: "En curso" },
    { id: "tournaments", label: "Torneos" },
    { id: "completed", label: "Finalizadas" },
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
    "country-by-map": "Pais en el mapa",
};

const MODE_ROUTES = {
    "country-by-capital": "/offline/country-by-capital",
    "capital-by-country": "/offline/capital-by-country",
    "country-by-shape": "/offline/country-by-shape",
};

const CONTINENT_ROUTE_SEGMENTS = {
    america: "america",
    americas: "america",
    europa: "europa",
    europe: "europa",
    asia: "asia",
    africa: "africa",
    oceania: "oceania",
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

function normalizeRouteValue(value) {
    return String(value || "").trim().toLowerCase();
}

function getContinueRoute(match) {
    if (match.mode === "country-by-continent") {
        const continentKey = normalizeRouteValue(
            match.continent || match.metadata?.continentLabel
        );
        const routeSegment = CONTINENT_ROUTE_SEGMENTS[continentKey];

        return routeSegment ? `/offline/continent-selection/${routeSegment}` : "";
    }

    return MODE_ROUTES[match.mode] || "";
}

function Ranking() {
    const location = useLocation();
    const navigate = useNavigate();
    const isHistoryView = location.pathname === "/history";
    const [status, setStatus] = useState("");
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
    const [discardCandidate, setDiscardCandidate] = useState(null);

    useEffect(() => {
        setStatus("");
        setPage(1);
    }, [isHistoryView]);

    useEffect(() => {
        const loadMatches = async () => {
            setLoading(true);
            setError("");

            try {
                const isTournaments = status === "tournaments";
                const response = await getMyMatches({
                    page,
                    limit: 8,
                    status: isTournaments ? "" : status,
                    kind: isTournaments ? "tournament" : "",
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
        setProcessingMatchId(matchId);
        setError("");

        try {
            await abandonMatch(matchId);

            const isTournaments = status === "tournaments";
            const response = await getMyMatches({
                page,
                limit: 8,
                status: isTournaments ? "" : status,
                kind: isTournaments ? "tournament" : "",
            });

            const shouldGoToPreviousPage =
                response.data.length === 0 && response.pagination.total > 0 && page > 1;

            if (shouldGoToPreviousPage) {
                setDiscardCandidate(null);
                setPage((currentPage) => Math.max(currentPage - 1, 1));
                return;
            }

            setMatches(response.data);
            setPagination(response.pagination);
            setDiscardCandidate(null);
        } catch (err) {
            setError(err.message || "No se pudo descartar la partida.");
            setDiscardCandidate(null);
        } finally {
            setProcessingMatchId(null);
        }
    }

    function handleContinueMatch(match) {
        const route = getContinueRoute(match);

        if (!route) {
            setError("No se pudo encontrar la pantalla para retomar esta partida.");
            return;
        }

        rememberResumeMatch(match);
        navigate(route, {
            state: {
                fromHistory: true,
                resumeMatchId: match.id,
            },
        });
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
        ? "Una vista simple de tus partidas en curso y finalizadas."
        : "Segui tus partidas en curso y tu actividad guardada en una sola vista.";

    return (
        <div className="ranking-page">
            <header className="ranking-header">
                <div className="ranking-header-glow" />

                <div className="ranking-header-actions">
                    <Link
                        to={isHistoryView ? "/profile" : "/mainmenu"}
                        className="ranking-back-button"
                    >
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
                                const isTournament =
                                    match.mode === "tournament" ||
                                    Boolean(match.metadata?.is_tournament);

                                if (isTournament) {
                                    const won = match.metadata?.result === "win";

                                    return (
                                        <article
                                            className="ranking-match-card"
                                            key={match.id}
                                        >
                                            <div className="ranking-match-head">
                                                <div className="ranking-match-title-block">
                                                    <div className="ranking-match-topline">
                                                        <span
                                                            className={`ranking-status-badge ${
                                                                won
                                                                    ? "is-completed"
                                                                    : "is-abandoned"
                                                            }`}
                                                        >
                                                            {won ? "Ganaste" : "Perdiste"}
                                                        </span>
                                                        <span className="ranking-match-mode">
                                                            Torneo
                                                        </span>
                                                    </div>

                                                    <h3>
                                                        {match.metadata?.tournament_name ||
                                                            "Torneo"}
                                                    </h3>
                                                </div>
                                            </div>

                                            <div className="ranking-match-body">
                                                <div className="ranking-match-quick-stats">
                                                    <div>
                                                        <span>Resultado</span>
                                                        <strong>
                                                            {won
                                                                ? "Campeon"
                                                                : "Eliminado"}
                                                        </strong>
                                                    </div>
                                                    <div>
                                                        <span>Campeon</span>
                                                        <strong>
                                                            {match.metadata
                                                                ?.champion_username ||
                                                                "-"}
                                                        </strong>
                                                    </div>
                                                    <div>
                                                        <span>Fecha</span>
                                                        <strong>
                                                            {formatDate(
                                                                match.finishedAt
                                                            )}
                                                        </strong>
                                                    </div>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                }

                                const statusMeta =
                                    STATUS_META[match.status] || STATUS_META.ongoing;
                                const isProcessing = processingMatchId === match.id;
                                const continueRoute = getContinueRoute(match);
                                const roundLabel = match.totalRounds
                                    ? `${match.roundReached} de ${match.totalRounds}`
                                    : match.roundReached;
                                const progressPercent = match.totalRounds
                                    ? Math.min(
                                          Math.max(
                                              (Number(match.roundReached) /
                                                  Number(match.totalRounds)) *
                                                  100,
                                              0
                                          ),
                                          100
                                      )
                                    : 0;

                                return (
                                    <article className="ranking-match-card" key={match.id}>
                                        <div className="ranking-match-head">
                                            <div className="ranking-match-title-block">
                                                <div className="ranking-match-topline">
                                                    <span
                                                        className={`ranking-status-badge ${statusMeta.className}`}
                                                    >
                                                        {statusMeta.label}
                                                    </span>
                                                    <span className="ranking-match-mode">
                                                        {getModeLabel(match.mode)}
                                                    </span>
                                                </div>

                                                <h3>
                                                    {match.continent
                                                        ? `${match.continent}`
                                                        : "Partida general"}
                                                </h3>
                                            </div>

                                            <div className="ranking-match-score-pill">
                                                <span>Score</span>
                                                <strong>{match.score}</strong>
                                            </div>
                                        </div>

                                        <div className="ranking-match-body">
                                            <div className="ranking-match-progress">
                                                <div>
                                                    <span>Progreso</span>
                                                    <strong>Ronda {roundLabel}</strong>
                                                </div>
                                                <div
                                                    className="ranking-progress-track"
                                                    aria-hidden="true"
                                                >
                                                    <span
                                                        style={{
                                                            width: `${progressPercent}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="ranking-match-quick-stats">
                                                <div>
                                                    <span>Aciertos</span>
                                                    <strong>{match.correctCount}</strong>
                                                </div>
                                                <div>
                                                    <span>Errores</span>
                                                    <strong>{match.wrongCount}</strong>
                                                </div>
                                                <div>
                                                    <span>Vidas</span>
                                                    <strong>{match.livesLeft}</strong>
                                                </div>
                                                <div>
                                                    <span>
                                                        {match.status === "completed"
                                                            ? "Finalizada"
                                                            : "Actividad"}
                                                    </span>
                                                    <strong>
                                                        {formatDate(
                                                            match.status === "completed"
                                                                ? match.finishedAt
                                                                : match.updatedAt
                                                        )}
                                                    </strong>
                                                </div>
                                            </div>

                                            {match.status === "ongoing" && (
                                                <div className="ranking-match-actions">
                                                    {continueRoute ? (
                                                        <button
                                                            type="button"
                                                            className="ranking-inline-primary-button"
                                                            onClick={() =>
                                                                handleContinueMatch(match)
                                                            }
                                                            disabled={isProcessing}
                                                        >
                                                            Continuar
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        className="ranking-inline-danger-button"
                                                        onClick={() => setDiscardCandidate(match)}
                                                        disabled={isProcessing}
                                                    >
                                                        {isProcessing
                                                            ? "Descartando..."
                                                            : "Descartar"}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
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

            {discardCandidate && (
                <div
                    className="ranking-confirm-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="ranking-discard-title"
                >
                    <div className="ranking-confirm-modal">
                        <span className="ranking-confirm-kicker">
                            {getModeLabel(discardCandidate.mode)}
                        </span>
                        <h2 id="ranking-discard-title">Descartar partida</h2>
                        <p>
                            Esta partida va a dejar de aparecer en tus partidas guardadas.
                        </p>

                        <div className="ranking-confirm-actions">
                            <button
                                type="button"
                                className="ranking-confirm-secondary"
                                onClick={() => setDiscardCandidate(null)}
                                disabled={processingMatchId === discardCandidate.id}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="ranking-confirm-danger"
                                onClick={() => handleAbandonMatch(discardCandidate.id)}
                                disabled={processingMatchId === discardCandidate.id}
                            >
                                {processingMatchId === discardCandidate.id
                                    ? "Descartando..."
                                    : "Descartar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Ranking;
