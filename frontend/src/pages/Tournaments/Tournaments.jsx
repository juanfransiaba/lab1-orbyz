import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import "./Tournaments.css";

const MODE_OPTIONS = [
    {
        id: "country-by-capital",
        label: "Pais por capital",
    },
    {
        id: "capital-by-country",
        label: "Capital por pais",
    },
    {
        id: "country-by-shape",
        label: "Pais por silueta",
    },
    {
        id: "country-by-continent",
        label: "Pais por continente",
    },
];

const CONTINENTS = ["america", "europa", "asia", "africa", "oceania"];

const STATUS_LABELS = {
    waiting: "Inscripcion",
    active: "En juego",
    finished: "Finalizado",
    cancelled: "Cancelado",
};

function getModeLabel(mode) {
    return MODE_OPTIONS.find((option) => option.id === mode)?.label || mode;
}

function getRoundLabel(roundNumber, maxPlayers) {
    const totalRounds = Math.log2(maxPlayers || 4);

    if (roundNumber === totalRounds) {
        return "Final";
    }

    if (roundNumber === totalRounds - 1) {
        return "Semifinal";
    }

    if (roundNumber === totalRounds - 2) {
        return "Cuartos de final";
    }

    return `Ronda ${roundNumber}`;
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    return new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
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
    const [filter, setFilter] = useState("");
    const [tournaments, setTournaments] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [createForm, setCreateForm] = useState(buildEmptyForm);
    const [editForm, setEditForm] = useState(buildEmptyForm);
    const [joinCode, setJoinCode] = useState("");
    const [loadingList, setLoadingList] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [actionLoading, setActionLoading] = useState("");
    const [feedback, setFeedback] = useState("");

    const selectedTournament = detail?.tournament || null;
    const rounds = useMemo(
        () => groupMatchesByRound(detail?.matches || []),
        [detail?.matches]
    );
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
            setSelectedId((currentId) => currentId || data[0]?.id || null);
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
        refreshDetail(selectedId);
    }, [refreshDetail, selectedId]);

    useEffect(() => {
        if (!selectedTournament) {
            return;
        }

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
            setFeedback("Torneo creado. El codigo ya esta listo para compartir.");
        });
    }

    function handleUpdate(event) {
        event.preventDefault();

        if (!selectedTournament) {
            return;
        }

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
        if (!selectedTournament) {
            return;
        }

        runAction("leave", async () => {
            const snapshot = await leaveTournament(selectedTournament.id);
            applySnapshot(snapshot);
            setFeedback("Saliste del torneo.");
        });
    }

    function handleStart() {
        if (!selectedTournament) {
            return;
        }

        runAction("start", async () => {
            const snapshot = await startTournament(selectedTournament.id);
            applySnapshot(snapshot);
            setFeedback("Torneo iniciado. Ya se armo la llave.");
        });
    }

    function handleDelete() {
        if (!selectedTournament) {
            return;
        }

        runAction("delete", async () => {
            await deleteTournament(selectedTournament.id);
            setDetail(null);
            setSelectedId(null);
            setFeedback("Torneo eliminado o cancelado.");
            await loadList();
        });
    }

    function handleWinner(matchId, winnerUserId) {
        if (!selectedTournament) {
            return;
        }

        runAction(`winner-${matchId}-${winnerUserId}`, async () => {
            const snapshot = await setTournamentMatchWinner(
                selectedTournament.id,
                matchId,
                winnerUserId
            );
            applySnapshot(snapshot);
        });
    }

    const canStart =
        selectedTournament?.isCreator &&
        selectedTournament.status === "waiting" &&
        selectedTournament.participantCount === selectedTournament.maxPlayers;

    const canEdit =
        selectedTournament?.isCreator && selectedTournament.status === "waiting";

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
                    <span className="tournaments-title-kicker">
                        Geography Game System
                    </span>
                    <h1 className="tournaments-title">Torneos</h1>
                </div>

                <div className="tournaments-header-spacer" />
            </header>

            <main className="tournaments-main">
                <section className="tournaments-hero">
                    <div className="tournaments-hero-copy">
                        <span className="tournaments-eyebrow">Eliminacion directa</span>
                        <h2>Crea copas 1 vs 1 y deja que la llave avance ronda a ronda.</h2>
                        <p>
                            Todos juegan el mismo modo. Cuando una partida termina, el
                            ganador avanza al siguiente cruce hasta definir campeon.
                        </p>
                    </div>

                    <form className="tournaments-join-card" onSubmit={handleJoinByCode}>
                        <span>Codigo de torneo</span>
                        <div>
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

                {feedback && <p className="tournaments-feedback">{feedback}</p>}

                <section className="tournaments-workspace">
                    <aside className="tournaments-sidebar">
                        <form className="tournaments-create-card" onSubmit={handleCreate}>
                            <div className="tournaments-section-title">
                                <span>Nuevo torneo</span>
                                <strong>Crear copa</strong>
                            </div>

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

                            <button
                                type="submit"
                                className="tournaments-primary-button"
                                disabled={actionLoading === "create"}
                            >
                                Crear torneo
                            </button>
                        </form>

                        <div className="tournaments-list-card">
                            <div className="tournaments-list-head">
                                <div className="tournaments-section-title">
                                    <span>Disponibles</span>
                                    <strong>Torneos</strong>
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
                                            <span>
                                                {STATUS_LABELS[tournament.status] ||
                                                    tournament.status}
                                            </span>
                                            <strong>{tournament.name}</strong>
                                            <small>
                                                {tournament.participantCount}/
                                                {tournament.maxPlayers} jugadores
                                            </small>
                                        </button>
                                    ))}

                                {!loadingList && tournaments.length === 0 && (
                                    <p className="tournaments-muted">
                                        Todavia no hay torneos para este filtro.
                                    </p>
                                )}
                            </div>
                        </div>
                    </aside>

                    <section className="tournaments-detail">
                        {!selectedTournament && (
                            <div className="tournaments-empty-detail">
                                <span>Elegir torneo</span>
                                <p>Crea uno nuevo o selecciona una copa de la lista.</p>
                            </div>
                        )}

                        {selectedTournament && (
                            <>
                                <div className="tournaments-detail-hero">
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
                                                ? ` - ${selectedTournament.continent}`
                                                : ""}
                                        </p>
                                    </div>

                                    <div className="tournaments-code-box">
                                        <span>Codigo</span>
                                        <strong>{selectedTournament.code}</strong>
                                    </div>
                                </div>

                                <div className="tournaments-metrics">
                                    <div>
                                        <span>Jugadores</span>
                                        <strong>
                                            {selectedTournament.participantCount}/
                                            {selectedTournament.maxPlayers}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Creador</span>
                                        <strong>{selectedTournament.creatorUsername}</strong>
                                    </div>
                                    <div>
                                        <span>Campeon</span>
                                        <strong>
                                            {selectedTournament.winnerUsername || "-"}
                                        </strong>
                                    </div>
                                    <div>
                                        <span>Actividad</span>
                                        <strong>
                                            {formatDate(selectedTournament.updatedAt)}
                                        </strong>
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
                                                onClick={handleLeave}
                                                disabled={actionLoading === "leave"}
                                            >
                                                Salir del torneo
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
                                                    ? "Eliminar torneo"
                                                    : "Cancelar torneo"}
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
                                                Iniciar torneo
                                            </button>
                                        )}
                                </div>

                                {!canStart &&
                                    selectedTournament.isCreator &&
                                    selectedTournament.status === "waiting" && (
                                        <p className="tournaments-hint">
                                            Para iniciar, el torneo tiene que completar el cupo.
                                        </p>
                                    )}

                                {canEdit && (
                                    <form
                                        className="tournaments-edit-card"
                                        onSubmit={handleUpdate}
                                    >
                                        <div className="tournaments-section-title">
                                            <span>Configuracion</span>
                                            <strong>Editar antes de iniciar</strong>
                                        </div>

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
                                                            continent: event.target.value,
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
                                                        maxPlayers: event.target.value,
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
                                            Guardar cambios
                                        </button>
                                    </form>
                                )}

                                <div className="tournaments-detail-grid">
                                    <section className="tournaments-participants-card">
                                        <div className="tournaments-section-title">
                                            <span>Inscritos</span>
                                            <strong>Jugadores</strong>
                                        </div>

                                        <div className="tournaments-participants">
                                            {detail.participants.map((participant) => (
                                                <div
                                                    key={participant.id}
                                                    className={`tournaments-participant ${
                                                        participant.eliminated
                                                            ? "is-eliminated"
                                                            : ""
                                                    }`}
                                                >
                                                    <span>
                                                        {participant.username.charAt(0)}
                                                    </span>
                                                    <div>
                                                        <strong>
                                                            {participant.username}
                                                        </strong>
                                                        <small>
                                                            {participant.eliminated
                                                                ? "Eliminado"
                                                                : "En competencia"}
                                                        </small>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="tournaments-bracket-card">
                                        <div className="tournaments-section-title">
                                            <span>Llave</span>
                                            <strong>Cruces</strong>
                                        </div>

                                        {loadingDetail && (
                                            <p className="tournaments-muted">
                                                Cargando detalle...
                                            </p>
                                        )}

                                        {!loadingDetail && roundEntries.length === 0 && (
                                            <p className="tournaments-muted">
                                                La llave aparece cuando el creador inicia
                                                el torneo.
                                            </p>
                                        )}

                                        {!loadingDetail &&
                                            roundEntries.map(([roundNumber, matches]) => (
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
                                                        {matches.map((match) => (
                                                            <article
                                                                className="tournaments-match-card"
                                                                key={match.id}
                                                            >
                                                                <span>
                                                                    Cruce {match.matchOrder}
                                                                </span>

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

                                                                <small>
                                                                    {match.status ===
                                                                    "finished"
                                                                        ? `Ganador: ${match.winnerUsername}`
                                                                        : STATUS_LABELS[
                                                                              selectedTournament
                                                                                  .status
                                                                          ] || match.status}
                                                                </small>
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
