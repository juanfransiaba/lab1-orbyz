import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    createTournament,
    deleteTournament,
    getTournament,
    getTournaments,
    joinTournament,
    joinTournamentByCode,
    leaveTournament,
    setTournamentMatchWinner,
    startTournament,
    updateTournament,
} from "../../services/TournamentService.js";
import {
    connectOnlineSocket,
    decodeToken,
    emitWithAck,
} from "../../services/OnlineSocketService.js";
import "./Tournaments.css";

const MODE_OPTIONS = [
    { id: "country-by-capital", label: "Pais por capital" },
    { id: "capital-by-country", label: "Capital por pais" },
    { id: "country-by-shape", label: "Pais por silueta" },
    { id: "country-by-continent", label: "Pais por continente" },
];

const CONTINENTS = ["america", "europa", "asia", "africa", "oceania"];

const STATUS_LABELS = {
    waiting: "Inscripcion",
    active: "En juego",
    finished: "Finalizado",
    cancelled: "Cancelado",
};

const MATCH_STATUS_LABELS = {
    pending: "Pendiente",
    ready: "Listo",
    playing: "Jugando",
    finished: "Finalizado",
    bye: "Libre",
};

const ARENA_IMAGES = [
    { src: "/images/paises/italy.jpg", position: "center 46%" },
    { src: "/images/paises/japan.jpg", position: "center 48%" },
    { src: "/images/paises/brasil.jpg", position: "center 52%" },
    { src: "/images/paises/india.jpg", position: "center 46%" },
    { src: "/images/paises/greece.jpg", position: "center 48%" },
];

function getModeLabel(mode) {
    return MODE_OPTIONS.find((option) => option.id === mode)?.label || mode;
}

function getRoundLabel(roundNumber, maxPlayers) {
    const totalRounds = Math.log2(maxPlayers || 4);

    if (roundNumber === totalRounds) return "Final";
    if (roundNumber === totalRounds - 1) return "Semifinal";
    if (roundNumber === totalRounds - 2) return "Cuartos";

    return `Ronda ${roundNumber}`;
}

function buildEmptyForm() {
    return {
        name: "Copa geografica",
        mode: "country-by-capital",
        continent: "america",
        maxPlayers: "4",
    };
}

function groupMatchesByRound(matches) {
    return matches.reduce((rounds, match) => {
        const key = String(match.roundNumber);
        rounds[key] = rounds[key] || [];
        rounds[key].push(match);
        return rounds;
    }, {});
}

function Tournaments() {
    const navigate = useNavigate();
    const location = useLocation();
    const currentUser = useMemo(
        () => decodeToken(localStorage.getItem("token") || ""),
        []
    );
    const currentUserId = currentUser?.user_id;

    const [filter, setFilter] = useState("");
    const [tournaments, setTournaments] = useState([]);
    const [selectedId, setSelectedId] = useState(
        () => location.state?.tournamentId || null
    );
    const [detail, setDetail] = useState(null);
    const [createForm, setCreateForm] = useState(buildEmptyForm);
    const [editForm, setEditForm] = useState(buildEmptyForm);
    const [joinCode, setJoinCode] = useState("");
    const [loadingList, setLoadingList] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [actionLoading, setActionLoading] = useState("");
    const [feedback, setFeedback] = useState("");
    const [showTournamentList, setShowTournamentList] = useState(
        () => Boolean(location.state?.tournamentId)
    );

    const selectedTournament = detail?.tournament || null;
    const participants = useMemo(
        () => detail?.participants || [],
        [detail?.participants]
    );
    const matches = useMemo(() => detail?.matches || [], [detail?.matches]);
    const rounds = useMemo(() => groupMatchesByRound(matches), [matches]);
    const roundEntries = useMemo(
        () =>
            Object.entries(rounds).sort(
                ([roundA], [roundB]) => Number(roundA) - Number(roundB)
            ),
        [rounds]
    );

    const loadList = useCallback(async () => {
        setLoadingList(true);
        setFeedback("");

        try {
            const data = await getTournaments({ status: filter });
            setTournaments(data);
        } catch (error) {
            setFeedback(error.message || "No se pudieron cargar los torneos.");
        } finally {
            setLoadingList(false);
        }
    }, [filter]);

    const refreshDetail = useCallback(async (tournamentId) => {
        if (!tournamentId) {
            setDetail(null);
            return;
        }

        setLoadingDetail(true);

        try {
            const snapshot = await getTournament(tournamentId);
            setDetail(snapshot);
        } catch (error) {
            setFeedback(error.message || "No se pudo cargar el torneo.");
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    useEffect(() => {
        loadList();
    }, [loadList]);

    useEffect(() => {
        if (location.state?.feedback) {
            setFeedback(location.state.feedback);
        }
    }, [location.state]);

    useEffect(() => {
        refreshDetail(selectedId);
    }, [refreshDetail, selectedId]);

    useEffect(() => {
        if (!selectedTournament) return;

        setEditForm({
            name: selectedTournament.name,
            mode: selectedTournament.mode,
            continent: selectedTournament.continent || "america",
            maxPlayers: String(selectedTournament.maxPlayers),
        });
    }, [selectedTournament]);

    function applySnapshot(snapshot) {
        setDetail(snapshot);
        setSelectedId(snapshot.tournament.id);
        setShowTournamentList(false);
        setTournaments((current) => {
            const exists = current.some(
                (tournament) => tournament.id === snapshot.tournament.id
            );

            if (exists) {
                return current.map((tournament) =>
                    tournament.id === snapshot.tournament.id
                        ? snapshot.tournament
                        : tournament
                );
            }

            return [snapshot.tournament, ...current];
        });
    }

    function buildPayload(form) {
        return {
            name: form.name,
            mode: form.mode,
            continent:
                form.mode === "country-by-continent" ? form.continent : undefined,
            max_players: Number(form.maxPlayers),
        };
    }

    async function runAction(label, action) {
        setActionLoading(label);
        setFeedback("");

        try {
            await action();
        } catch (error) {
            setFeedback(error.message || "No se pudo completar la accion.");
        } finally {
            setActionLoading("");
        }
    }

    function handleCreate(event) {
        event.preventDefault();

        runAction("create", async () => {
            const snapshot = await createTournament(buildPayload(createForm));
            applySnapshot(snapshot);
            setCreateForm(buildEmptyForm());
            setFeedback("Torneo creado. Compartis el codigo y esperan el cupo.");
        });
    }

    function handleUpdate(event) {
        event.preventDefault();

        if (!selectedTournament) return;

        runAction("update", async () => {
            const snapshot = await updateTournament(
                selectedTournament.id,
                buildPayload(editForm)
            );
            applySnapshot(snapshot);
            setFeedback("Torneo actualizado.");
        });
    }

    function handleJoinByCode(event) {
        event.preventDefault();

        runAction("join-code", async () => {
            const snapshot = await joinTournamentByCode(joinCode);
            applySnapshot(snapshot);
            setJoinCode("");
            setFeedback("Te uniste al torneo.");
        });
    }

    function handleJoin(tournamentId) {
        runAction(`join-${tournamentId}`, async () => {
            const snapshot = await joinTournament(tournamentId);
            applySnapshot(snapshot);
        });
    }

    function handleLeave() {
        if (!selectedTournament) return;

        runAction("leave", async () => {
            const snapshot = await leaveTournament(selectedTournament.id);
            applySnapshot(snapshot);
            setFeedback("Saliste del torneo.");
        });
    }

    function handleStart() {
        if (!selectedTournament) return;

        runAction("start", async () => {
            const snapshot = await startTournament(selectedTournament.id);
            applySnapshot(snapshot);
            setFeedback("Torneo iniciado. La llave ya esta lista.");
        });
    }

    function handleDelete() {
        if (!selectedTournament) return;

        runAction("delete", async () => {
            await deleteTournament(selectedTournament.id);
            setDetail(null);
            setSelectedId(null);
            setFeedback("Torneo eliminado o cancelado.");
            await loadList();
        });
    }

    function handleWinner(matchId, winnerUserId) {
        if (!selectedTournament) return;

        runAction(`winner-${matchId}-${winnerUserId}`, async () => {
            const snapshot = await setTournamentMatchWinner(
                selectedTournament.id,
                matchId,
                winnerUserId
            );
            applySnapshot(snapshot);
        });
    }

    function handlePlayMatch(match) {
        if (!selectedTournament) return;

        runAction(`play-${match.id}`, async () => {
            await connectOnlineSocket();

            const response = await emitWithAck("tournament:playMatch", {
                tournamentMatchId: match.id,
            });

            navigate("/online/match", {
                state: {
                    room: response.room,
                    tournamentId: selectedTournament.id,
                },
            });
        });
    }

    function canPlayMatch(match) {
        const playableStatus =
            match.status === "ready" || match.status === "playing";
        const isMyMatch =
            Number(match.player1Id) === Number(currentUserId) ||
            Number(match.player2Id) === Number(currentUserId);

        return selectedTournament?.status === "active" && playableStatus && isMyMatch;
    }

    const canStart =
        selectedTournament?.isCreator &&
        selectedTournament.status === "waiting" &&
        selectedTournament.participantCount === selectedTournament.maxPlayers;

    const canEdit =
        selectedTournament?.isCreator && selectedTournament.status === "waiting";

    const cupoLabel = selectedTournament
        ? `${selectedTournament.participantCount}/${selectedTournament.maxPlayers}`
        : "0/0";

    return (
        <div
            className={`tournaments-page ${
                showTournamentList ? "is-showing-list" : ""
            } ${selectedTournament ? "has-selected-tournament" : ""}`}
        >
            <header className="tournaments-header">
                <div className="tournaments-header-actions">
                    <Link to="/mainMenu" className="tournaments-back-button">
                        Volver
                    </Link>
                </div>
                <div className="tournaments-title-wrap">
                    <span className="tournaments-title-kicker">
                        Geography Game System
                    </span>
                    <h1 className="tournaments-title">Torneos</h1>
                </div>
                <div className="tournaments-header-spacer" />
            </header>

            <main className="tournaments-main">
                <section className="tournaments-arena">
                    <div className="tournaments-arena-carousel" aria-hidden="true">
                        {ARENA_IMAGES.map((image, index) => (
                            <span
                                key={image.src}
                                style={{
                                    backgroundImage: `url(${image.src})`,
                                    backgroundPosition: image.position,
                                    animationDelay: `${index * 5}s`,
                                }}
                            />
                        ))}
                    </div>

                    <div className="tournaments-arena-content">
                        <div className="tournaments-arena-copy">
                            <span className="tournaments-eyebrow">Torneo online</span>
                            <h2>Arma la llave y juga hasta coronar campeon.</h2>
                            <p>
                                Crea una copa, comparti el codigo y cada cruce se juega
                                como una partida online 1 vs 1.
                            </p>
                        </div>

                    </div>
                </section>
                <section className="tournaments-intro">
                    <div className="tournaments-intro-copy">
                        <span className="tournaments-eyebrow">
                            Eliminacion directa
                        </span>
                        <h2>Organiza una copa online en pocos pasos.</h2>
                        <p>
                            Elegi modo, completa el cupo y jugá cada cruce como una
                            partida online normal. La llave avanza sola cuando termina.
                        </p>
                    </div>

                    <div className="tournaments-flow" aria-label="Flujo del torneo">
                        <div>
                            <span>1</span>
                            <strong>Crear</strong>
                            <small>Modo y cupo</small>
                        </div>
                        <div>
                            <span>2</span>
                            <strong>Unirse</strong>
                            <small>Codigo privado</small>
                        </div>
                        <div>
                            <span>3</span>
                            <strong>Jugar</strong>
                            <small>Llave 1 vs 1</small>
                        </div>
                    </div>
                </section>

                {feedback && <p className="tournaments-feedback">{feedback}</p>}

                <section className="tournaments-setup" id="crear-torneo">
                    <form className="tournaments-create-card" onSubmit={handleCreate}>
                        <div className="tournaments-card-head">
                            <div>
                                <span>Crear torneo</span>
                                <h3>Nueva copa</h3>
                                <p>Defini el modo, el cupo y comparti el codigo.</p>
                            </div>
                            <button
                                type="submit"
                                className="tournaments-primary-button"
                                disabled={actionLoading === "create"}
                            >
                                Crear torneo
                            </button>
                        </div>

                        <div className="tournaments-form-grid">
                            <label>
                                Nombre
                                <input
                                    value={createForm.name}
                                    onChange={(event) =>
                                        setCreateForm((current) => ({
                                            ...current,
                                            name: event.target.value,
                                        }))
                                    }
                                />
                            </label>

                            <label>
                                Modo
                                <select
                                    value={createForm.mode}
                                    onChange={(event) =>
                                        setCreateForm((current) => ({
                                            ...current,
                                            mode: event.target.value,
                                        }))
                                    }
                                >
                                    {MODE_OPTIONS.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {createForm.mode === "country-by-continent" && (
                                <label>
                                    Continente
                                    <select
                                        value={createForm.continent}
                                        onChange={(event) =>
                                            setCreateForm((current) => ({
                                                ...current,
                                                continent: event.target.value,
                                            }))
                                        }
                                    >
                                        {CONTINENTS.map((continent) => (
                                            <option key={continent} value={continent}>
                                                {continent}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            <label>
                                Cupo
                                <select
                                    value={createForm.maxPlayers}
                                    onChange={(event) =>
                                        setCreateForm((current) => ({
                                            ...current,
                                            maxPlayers: event.target.value,
                                        }))
                                    }
                                >
                                    <option value="4">4 jugadores</option>
                                    <option value="8">8 jugadores</option>
                                    <option value="16">16 jugadores</option>
                                </select>
                            </label>
                        </div>
                    </form>

                    <form className="tournaments-join-card" onSubmit={handleJoinByCode}>
                        <div>
                            <span>Unirse a torneo</span>
                            <h3>Ingresar con codigo</h3>
                            <p>Usa el codigo de sala para entrar a una copa existente.</p>
                        </div>
                        <div className="tournaments-code-form">
                            <input
                                value={joinCode}
                                onChange={(event) =>
                                    setJoinCode(event.target.value.toUpperCase())
                                }
                                placeholder="ABC23"
                                maxLength={8}
                            />
                            <button type="submit" disabled={actionLoading === "join-code"}>
                                Unirse
                            </button>
                        </div>
                    </form>
                </section>

                <section className="tournaments-browse-strip">
                    <div>
                        <span>Torneos existentes</span>
                        <strong>Ver copas creadas</strong>
                    </div>
                    <button
                        type="button"
                        onClick={() =>
                            setShowTournamentList((isVisible) => !isVisible)
                        }
                    >
                        {showTournamentList ? "Ocultar lista" : "Ver torneos"}
                    </button>
                </section>

                <section className="tournaments-workspace">
                    <aside className="tournaments-list-card">
                        <div className="tournaments-list-head">
                            <div>
                                <span>Torneos</span>
                                <h3>Disponibles</h3>
                            </div>
                            <select
                                value={filter}
                                onChange={(event) => setFilter(event.target.value)}
                            >
                                <option value="">Todos</option>
                                <option value="waiting">Inscripcion</option>
                                <option value="active">En juego</option>
                                <option value="finished">Finalizados</option>
                            </select>
                        </div>

                        <div className="tournaments-list">
                            {loadingList && (
                                <p className="tournaments-muted">Cargando torneos...</p>
                            )}

                            {!loadingList &&
                                tournaments.map((tournament) => (
                                    <button
                                        key={tournament.id}
                                        type="button"
                                        className={`tournaments-list-item ${
                                            selectedId === tournament.id
                                                ? "is-selected"
                                                : ""
                                        }`}
                                        onClick={() => setSelectedId(tournament.id)}
                                    >
                                        <span>{STATUS_LABELS[tournament.status]}</span>
                                        <strong>{tournament.name}</strong>
                                        <small>
                                            {tournament.participantCount}/
                                            {tournament.maxPlayers} jugadores
                                        </small>
                                    </button>
                                ))}

                            {!loadingList && tournaments.length === 0 && (
                                <div className="tournaments-empty-list">
                                    <strong>No hay torneos</strong>
                                    <p>Crea una copa o entra con un codigo.</p>
                                </div>
                            )}
                        </div>
                    </aside>

                    <section className="tournaments-detail">
                        {!selectedTournament && (
                            <div className="tournaments-empty-detail">
                                <span>Sin torneo seleccionado</span>
                                <h3>Elegí una copa para ver su estado.</h3>
                                <p>Cuando inicie, aca vas a ver jugadores, cruces y campeon.</p>
                            </div>
                        )}

                        {selectedTournament && (
                            <>
                                <div className="tournaments-detail-head">
                                    <div>
                                        <span
                                            className={`tournaments-status is-${selectedTournament.status}`}
                                        >
                                            {STATUS_LABELS[selectedTournament.status] ||
                                                selectedTournament.status}
                                        </span>
                                        <h2>{selectedTournament.name}</h2>
                                        <p>
                                            {getModeLabel(selectedTournament.mode)}
                                            {selectedTournament.continent
                                                ? ` · ${selectedTournament.continent}`
                                                : ""}
                                        </p>
                                    </div>

                                    <div className="tournaments-code-box">
                                        <span>Codigo</span>
                                        <strong>{selectedTournament.code}</strong>
                                    </div>
                                </div>

                                <div className="tournaments-summary">
                                    <div className="tournaments-summary-main">
                                        <span>Cupo actual</span>
                                        <strong>{cupoLabel} jugadores</strong>
                                        <small>
                                            {selectedTournament.status === "waiting"
                                                ? "Esperando participantes"
                                                : STATUS_LABELS[
                                                      selectedTournament.status
                                                  ] || selectedTournament.status}
                                        </small>
                                    </div>
                                    <div>
                                        <span>Organizador</span>
                                        <strong>{selectedTournament.creatorUsername}</strong>
                                    </div>
                                    <div>
                                        <span>Formato</span>
                                        <strong>Llave 1 vs 1</strong>
                                    </div>
                                </div>

                                <div className="tournaments-actions">
                                    {!selectedTournament.isJoined &&
                                        selectedTournament.status === "waiting" && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleJoin(selectedTournament.id)
                                                }
                                                disabled={
                                                    actionLoading ===
                                                    `join-${selectedTournament.id}`
                                                }
                                            >
                                                Unirme
                                            </button>
                                        )}

                                    {selectedTournament.isJoined &&
                                        !selectedTournament.isCreator &&
                                        selectedTournament.status === "waiting" && (
                                            <button
                                                type="button"
                                                className="tournaments-secondary-button"
                                                onClick={handleLeave}
                                                disabled={actionLoading === "leave"}
                                            >
                                                Salir
                                            </button>
                                        )}

                                    {selectedTournament.isCreator &&
                                        selectedTournament.status === "waiting" && (
                                            <button
                                                type="button"
                                                className="tournaments-primary-button"
                                                onClick={handleStart}
                                                disabled={!canStart || actionLoading === "start"}
                                            >
                                                Iniciar
                                            </button>
                                        )}

                                    {selectedTournament.isCreator &&
                                        selectedTournament.status !== "finished" && (
                                            <button
                                                type="button"
                                                className="tournaments-danger-button"
                                                onClick={handleDelete}
                                                disabled={actionLoading === "delete"}
                                            >
                                                {selectedTournament.status === "waiting"
                                                    ? "Eliminar"
                                                    : "Cancelar"}
                                            </button>
                                        )}
                                </div>

                                {!canStart &&
                                    selectedTournament.isCreator &&
                                    selectedTournament.status === "waiting" && (
                                        <p className="tournaments-hint">
                                            Completa el cupo para iniciar la llave.
                                        </p>
                                    )}

                                {canEdit && (
                                    <details className="tournaments-edit-card">
                                        <summary>Ajustes del torneo</summary>
                                        <form onSubmit={handleUpdate}>
                                            <label>
                                                Nombre
                                                <input
                                                    value={editForm.name}
                                                    onChange={(event) =>
                                                        setEditForm((current) => ({
                                                            ...current,
                                                            name: event.target.value,
                                                        }))
                                                    }
                                                />
                                            </label>

                                            <label>
                                                Modo
                                                <select
                                                    value={editForm.mode}
                                                    onChange={(event) =>
                                                        setEditForm((current) => ({
                                                            ...current,
                                                            mode: event.target.value,
                                                        }))
                                                    }
                                                >
                                                    {MODE_OPTIONS.map((option) => (
                                                        <option
                                                            key={option.id}
                                                            value={option.id}
                                                        >
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>

                                            {editForm.mode === "country-by-continent" && (
                                                <label>
                                                    Continente
                                                    <select
                                                        value={editForm.continent}
                                                        onChange={(event) =>
                                                            setEditForm((current) => ({
                                                                ...current,
                                                                continent:
                                                                    event.target.value,
                                                            }))
                                                        }
                                                    >
                                                        {CONTINENTS.map((continent) => (
                                                            <option
                                                                key={continent}
                                                                value={continent}
                                                            >
                                                                {continent}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            )}

                                            <label>
                                                Cupo
                                                <select
                                                    value={editForm.maxPlayers}
                                                    onChange={(event) =>
                                                        setEditForm((current) => ({
                                                            ...current,
                                                            maxPlayers:
                                                                event.target.value,
                                                        }))
                                                    }
                                                >
                                                    <option value="4">4 jugadores</option>
                                                    <option value="8">8 jugadores</option>
                                                    <option value="16">16 jugadores</option>
                                                </select>
                                            </label>

                                            <button
                                                type="submit"
                                                disabled={actionLoading === "update"}
                                            >
                                                Guardar
                                            </button>
                                        </form>
                                    </details>
                                )}

                                <div className="tournaments-content-grid">
                                    <section className="tournaments-participants-card">
                                        <div className="tournaments-section-head">
                                            <span>Jugadores</span>
                                            <strong>{participants.length}</strong>
                                        </div>

                                        <div className="tournaments-participants">
                                            {participants.map((participant) => (
                                                <div
                                                    key={participant.id}
                                                    className={`tournaments-participant ${
                                                        participant.eliminated
                                                            ? "is-eliminated"
                                                            : ""
                                                    }`}
                                                >
                                                    <span>
                                                        {participant.username
                                                            .charAt(0)
                                                            .toUpperCase()}
                                                    </span>
                                                    <div>
                                                        <strong>
                                                            {participant.username}
                                                        </strong>
                                                        <small>
                                                            {participant.eliminated
                                                                ? "Eliminado"
                                                                : "Activo"}
                                                        </small>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="tournaments-bracket-card">
                                        <div className="tournaments-section-head">
                                            <span>Llave</span>
                                            <strong>{matches.length} cruces</strong>
                                        </div>

                                        {loadingDetail && (
                                            <p className="tournaments-muted">
                                                Cargando detalle...
                                            </p>
                                        )}

                                        {!loadingDetail && roundEntries.length === 0 && (
                                            <div className="tournaments-empty-bracket">
                                                <strong>La llave todavia no empezo</strong>
                                                <p>
                                                    Cuando el creador inicie el torneo se
                                                    generan los cruces.
                                                </p>
                                            </div>
                                        )}

                                        {!loadingDetail &&
                                            roundEntries.map(([roundNumber, roundMatches]) => (
                                                <div
                                                    className="tournaments-round"
                                                    key={roundNumber}
                                                >
                                                    <h3>
                                                        {getRoundLabel(
                                                            Number(roundNumber),
                                                            selectedTournament.maxPlayers
                                                        )}
                                                    </h3>

                                                    <div className="tournaments-match-list">
                                                        {roundMatches.map((match) => (
                                                            <article
                                                                className="tournaments-match-card"
                                                                key={match.id}
                                                            >
                                                                <div className="tournaments-match-top">
                                                                    <span>
                                                                        Cruce{" "}
                                                                        {match.matchOrder}
                                                                    </span>
                                                                    <em>
                                                                        {MATCH_STATUS_LABELS[
                                                                            match.status
                                                                        ] || match.status}
                                                                    </em>
                                                                </div>

                                                                {[1, 2].map((slot) => {
                                                                    const playerId =
                                                                        slot === 1
                                                                            ? match.player1Id
                                                                            : match.player2Id;
                                                                    const username =
                                                                        slot === 1
                                                                            ? match.player1Username
                                                                            : match.player2Username;
                                                                    const isWinner =
                                                                        playerId &&
                                                                        Number(
                                                                            match.winnerUserId
                                                                        ) ===
                                                                            Number(playerId);

                                                                    return (
                                                                        <div
                                                                            className={`tournaments-match-player ${
                                                                                isWinner
                                                                                    ? "is-winner"
                                                                                    : ""
                                                                            }`}
                                                                            key={slot}
                                                                        >
                                                                            <strong>
                                                                                {username ||
                                                                                    "Pendiente"}
                                                                            </strong>

                                                                            {selectedTournament.isCreator &&
                                                                                selectedTournament.status ===
                                                                                    "active" &&
                                                                                match.status ===
                                                                                    "ready" &&
                                                                                !match.onlineRoomCode &&
                                                                                playerId && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            handleWinner(
                                                                                                match.id,
                                                                                                playerId
                                                                                            )
                                                                                        }
                                                                                        disabled={
                                                                                            actionLoading ===
                                                                                            `winner-${match.id}-${playerId}`
                                                                                        }
                                                                                    >
                                                                                        Gana
                                                                                    </button>
                                                                                )}
                                                                        </div>
                                                                    );
                                                                })}

                                                                {canPlayMatch(match) && (
                                                                    <button
                                                                        type="button"
                                                                        className="tournaments-play-match-button"
                                                                        onClick={() =>
                                                                            handlePlayMatch(
                                                                                match
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            actionLoading ===
                                                                            `play-${match.id}`
                                                                        }
                                                                    >
                                                                        {match.status ===
                                                                        "playing"
                                                                            ? "Entrar a mi partida"
                                                                            : "Jugar mi partida"}
                                                                    </button>
                                                                )}

                                                                {match.status ===
                                                                    "finished" && (
                                                                    <small>
                                                                        Ganador:{" "}
                                                                        {match.winnerUsername}
                                                                    </small>
                                                                )}
                                                            </article>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                    </section>
                                </div>
                            </>
                        )}
                    </section>
                </section>
            </main>
        </div>
    );
}

export default Tournaments;
