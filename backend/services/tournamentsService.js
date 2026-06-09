const pool = require("../db");

const VALID_MODES = new Set([
    "country-by-capital",
    "capital-by-country",
    "country-by-shape",
    "country-by-continent",
]);

const VALID_STATUSES = new Set(["waiting", "active", "finished", "cancelled"]);
const VALID_MAX_PLAYERS = new Set([4, 8, 16]);
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

class ServiceError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}

function fail(statusCode, message) {
    throw new ServiceError(statusCode, message);
}

async function withTransaction(callback) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

function sanitizeName(name) {
    const cleanName = String(name || "").trim();

    if (cleanName.length < 3 || cleanName.length > 80) {
        fail(400, "El nombre del torneo debe tener entre 3 y 80 caracteres");
    }

    return cleanName;
}

function sanitizeMode(mode) {
    const cleanMode = String(mode || "").trim();

    if (!VALID_MODES.has(cleanMode)) {
        fail(400, "Modo de torneo invalido");
    }

    return cleanMode;
}

function sanitizeMaxPlayers(maxPlayers) {
    const cleanMaxPlayers = Number(maxPlayers);

    if (!VALID_MAX_PLAYERS.has(cleanMaxPlayers)) {
        fail(400, "La cantidad de jugadores debe ser 4, 8 o 16");
    }

    return cleanMaxPlayers;
}

function sanitizeContinent(mode, continent) {
    if (mode !== "country-by-continent") {
        return null;
    }

    const cleanContinent = String(continent || "").trim().toLowerCase();

    if (!cleanContinent) {
        fail(400, "El continente es obligatorio para este modo");
    }

    return cleanContinent;
}

function shuffle(items) {
    const copy = [...items];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

async function generateCode(db = pool) {
    for (let attempt = 0; attempt < 20; attempt++) {
        let code = "";

        for (let i = 0; i < 5; i++) {
            code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        }

        const { rows } = await db.query(
            "SELECT tournament_id FROM tournaments WHERE code = $1",
            [code]
        );

        if (rows.length === 0) {
            return code;
        }
    }

    fail(500, "No se pudo generar un codigo de torneo");
}

function normalizeTournament(row, viewerId) {
    if (!row) {
        return null;
    }

    return {
        tournament_id: row.tournament_id,
        name: row.name,
        code: row.code,
        created_by: row.created_by,
        creator_username: row.creator_username,
        mode: row.mode,
        continent: row.continent,
        max_players: row.max_players,
        status: row.status,
        winner_user_id: row.winner_user_id,
        winner_username: row.winner_username,
        participant_count: Number(row.participant_count || 0),
        is_creator: Number(row.created_by) === Number(viewerId),
        is_joined: Boolean(row.is_joined),
        created_at: row.created_at,
        started_at: row.started_at,
        finished_at: row.finished_at,
        updated_at: row.updated_at,
    };
}

function normalizeParticipant(row) {
    return {
        participant_id: row.participant_id,
        tournament_id: row.tournament_id,
        user_id: row.user_id,
        username: row.username,
        eliminated: row.eliminated,
        joined_at: row.joined_at,
    };
}

function normalizeMatch(row) {
    return {
        tournament_match_id: row.tournament_match_id,
        tournament_id: row.tournament_id,
        round_number: row.round_number,
        match_order: row.match_order,
        player1_id: row.player1_id,
        player1_username: row.player1_username,
        player2_id: row.player2_id,
        player2_username: row.player2_username,
        winner_user_id: row.winner_user_id,
        winner_username: row.winner_username,
        online_room_code: row.online_room_code,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function getTournamentSnapshot(tournamentId, viewerId, db = pool) {
    const tournamentResult = await db.query(
        `SELECT t.*,
                creator.username AS creator_username,
                winner.username AS winner_username,
                COUNT(tp.participant_id)::int AS participant_count,
                EXISTS (
                    SELECT 1
                    FROM tournament_participants own_tp
                    WHERE own_tp.tournament_id = t.tournament_id
                      AND own_tp.user_id = $2
                ) AS is_joined
         FROM tournaments t
         JOIN users creator ON creator.user_id = t.created_by
         LEFT JOIN users winner ON winner.user_id = t.winner_user_id
         LEFT JOIN tournament_participants tp ON tp.tournament_id = t.tournament_id
         WHERE t.tournament_id = $1
         GROUP BY t.tournament_id, creator.username, winner.username`,
        [tournamentId, viewerId]
    );

    if (tournamentResult.rows.length === 0) {
        fail(404, "Torneo no encontrado");
    }

    const participantsResult = await db.query(
        `SELECT tp.*, u.username
         FROM tournament_participants tp
         JOIN users u ON u.user_id = tp.user_id
         WHERE tp.tournament_id = $1
         ORDER BY tp.joined_at ASC, tp.participant_id ASC`,
        [tournamentId]
    );

    const matchesResult = await db.query(
        `SELECT tm.*,
                p1.username AS player1_username,
                p2.username AS player2_username,
                winner.username AS winner_username
         FROM tournament_matches tm
         LEFT JOIN users p1 ON p1.user_id = tm.player1_id
         LEFT JOIN users p2 ON p2.user_id = tm.player2_id
         LEFT JOIN users winner ON winner.user_id = tm.winner_user_id
         WHERE tm.tournament_id = $1
         ORDER BY tm.round_number ASC, tm.match_order ASC`,
        [tournamentId]
    );

    return {
        tournament: normalizeTournament(tournamentResult.rows[0], viewerId),
        participants: participantsResult.rows.map(normalizeParticipant),
        matches: matchesResult.rows.map(normalizeMatch),
    };
}

async function listTournaments({ status = "", viewerId }) {
    const cleanStatus = String(status || "").trim().toLowerCase();
    const params = [viewerId];
    let statusClause = "";

    if (cleanStatus) {
        if (!VALID_STATUSES.has(cleanStatus)) {
            fail(400, "Filtro de estado invalido");
        }

        params.push(cleanStatus);
        statusClause = `WHERE t.status = $${params.length}`;
    }

    const { rows } = await pool.query(
        `SELECT t.*,
                creator.username AS creator_username,
                winner.username AS winner_username,
                COUNT(tp.participant_id)::int AS participant_count,
                EXISTS (
                    SELECT 1
                    FROM tournament_participants own_tp
                    WHERE own_tp.tournament_id = t.tournament_id
                      AND own_tp.user_id = $1
                ) AS is_joined
         FROM tournaments t
         JOIN users creator ON creator.user_id = t.created_by
         LEFT JOIN users winner ON winner.user_id = t.winner_user_id
         LEFT JOIN tournament_participants tp ON tp.tournament_id = t.tournament_id
         ${statusClause}
         GROUP BY t.tournament_id, creator.username, winner.username
         ORDER BY
            CASE t.status
                WHEN 'waiting' THEN 0
                WHEN 'active' THEN 1
                WHEN 'finished' THEN 2
                ELSE 3
            END,
            t.updated_at DESC,
            t.tournament_id DESC
         LIMIT 60`,
        params
    );

    return rows.map((row) => normalizeTournament(row, viewerId));
}

async function createTournament(payload, creatorId) {
    const name = sanitizeName(payload.name);
    const mode = sanitizeMode(payload.mode);
    const maxPlayers = sanitizeMaxPlayers(payload.max_players ?? payload.maxPlayers);
    const continent = sanitizeContinent(mode, payload.continent);

    return withTransaction(async (client) => {
        const code = await generateCode(client);
        const { rows } = await client.query(
            `INSERT INTO tournaments (name, code, created_by, mode, continent, max_players)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING tournament_id`,
            [name, code, creatorId, mode, continent, maxPlayers]
        );

        const tournamentId = rows[0].tournament_id;

        await client.query(
            `INSERT INTO tournament_participants (tournament_id, user_id)
             VALUES ($1, $2)`,
            [tournamentId, creatorId]
        );

        return getTournamentSnapshot(tournamentId, creatorId, client);
    });
}

async function updateTournament(tournamentId, payload, userId) {
    return withTransaction(async (client) => {
        const tournament = await getTournamentForUpdate(client, tournamentId);

        ensureCreator(tournament, userId);

        if (tournament.status !== "waiting") {
            fail(400, "Solo se puede editar un torneo que todavia no empezo");
        }

        const countResult = await client.query(
            `SELECT COUNT(*)::int AS participant_count
             FROM tournament_participants
             WHERE tournament_id = $1`,
            [tournamentId]
        );
        const participantCount = countResult.rows[0]?.participant_count ?? 0;

        const name =
            payload.name === undefined ? tournament.name : sanitizeName(payload.name);
        const mode =
            payload.mode === undefined ? tournament.mode : sanitizeMode(payload.mode);
        const maxPlayers =
            payload.max_players === undefined && payload.maxPlayers === undefined
                ? tournament.max_players
                : sanitizeMaxPlayers(payload.max_players ?? payload.maxPlayers);
        const continent = sanitizeContinent(
            mode,
            payload.continent === undefined ? tournament.continent : payload.continent
        );

        if (participantCount > maxPlayers) {
            fail(400, "Ya hay mas participantes que el nuevo cupo elegido");
        }

        await client.query(
            `UPDATE tournaments
             SET name = $1,
                 mode = $2,
                 continent = $3,
                 max_players = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE tournament_id = $5`,
            [name, mode, continent, maxPlayers, tournamentId]
        );

        return getTournamentSnapshot(tournamentId, userId, client);
    });
}

async function getTournamentForUpdate(client, tournamentId) {
    const { rows } = await client.query(
        "SELECT * FROM tournaments WHERE tournament_id = $1 FOR UPDATE",
        [tournamentId]
    );

    if (rows.length === 0) {
        fail(404, "Torneo no encontrado");
    }

    return rows[0];
}

function ensureCreator(tournament, userId) {
    if (Number(tournament.created_by) !== Number(userId)) {
        fail(403, "Solo el creador puede hacer esta accion");
    }
}

async function joinTournament(tournamentId, userId) {
    return withTransaction(async (client) => {
        const tournament = await getTournamentForUpdate(client, tournamentId);

        if (tournament.status !== "waiting") {
            fail(400, "Solo podes unirte antes de que empiece el torneo");
        }

        const countResult = await client.query(
            `SELECT COUNT(*)::int AS participant_count
             FROM tournament_participants
             WHERE tournament_id = $1`,
            [tournamentId]
        );
        const participantCount = countResult.rows[0]?.participant_count ?? 0;

        if (participantCount >= tournament.max_players) {
            fail(400, "El torneo ya esta completo");
        }

        try {
            await client.query(
                `INSERT INTO tournament_participants (tournament_id, user_id)
                 VALUES ($1, $2)`,
                [tournamentId, userId]
            );
        } catch (error) {
            if (error.code === "23505") {
                fail(400, "Ya estas unido a este torneo");
            }

            throw error;
        }

        await client.query(
            "UPDATE tournaments SET updated_at = CURRENT_TIMESTAMP WHERE tournament_id = $1",
            [tournamentId]
        );

        return getTournamentSnapshot(tournamentId, userId, client);
    });
}

async function joinTournamentByCode(code, userId) {
    const cleanCode = String(code || "").trim().toUpperCase();

    if (!cleanCode) {
        fail(400, "El codigo del torneo es obligatorio");
    }

    const { rows } = await pool.query(
        "SELECT tournament_id FROM tournaments WHERE code = $1",
        [cleanCode]
    );

    if (rows.length === 0) {
        fail(404, "Torneo no encontrado");
    }

    return joinTournament(rows[0].tournament_id, userId);
}

async function leaveTournament(tournamentId, userId) {
    return withTransaction(async (client) => {
        const tournament = await getTournamentForUpdate(client, tournamentId);

        if (tournament.status !== "waiting") {
            fail(400, "Solo podes salir antes de que empiece el torneo");
        }

        if (Number(tournament.created_by) === Number(userId)) {
            fail(400, "El creador debe cancelar el torneo en lugar de salir");
        }

        const { rowCount } = await client.query(
            `DELETE FROM tournament_participants
             WHERE tournament_id = $1 AND user_id = $2`,
            [tournamentId, userId]
        );

        if (rowCount === 0) {
            fail(404, "No estas unido a este torneo");
        }

        await client.query(
            "UPDATE tournaments SET updated_at = CURRENT_TIMESTAMP WHERE tournament_id = $1",
            [tournamentId]
        );

        return getTournamentSnapshot(tournamentId, userId, client);
    });
}

async function deleteTournament(tournamentId, userId) {
    return withTransaction(async (client) => {
        const tournament = await getTournamentForUpdate(client, tournamentId);

        ensureCreator(tournament, userId);

        if (tournament.status === "finished") {
            fail(400, "No se puede eliminar un torneo finalizado");
        }

        if (tournament.status === "waiting") {
            await client.query("DELETE FROM tournaments WHERE tournament_id = $1", [
                tournamentId,
            ]);
            return { ok: true, deleted: true };
        }

        await client.query(
            `UPDATE tournaments
             SET status = 'cancelled',
                 finished_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE tournament_id = $1`,
            [tournamentId]
        );

        return { ok: true, deleted: false, status: "cancelled" };
    });
}

async function startTournament(tournamentId, userId) {
    return withTransaction(async (client) => {
        const tournament = await getTournamentForUpdate(client, tournamentId);

        ensureCreator(tournament, userId);

        if (tournament.status !== "waiting") {
            fail(400, "El torneo ya empezo o fue cerrado");
        }

        const participantsResult = await client.query(
            `SELECT tp.user_id
             FROM tournament_participants tp
             WHERE tp.tournament_id = $1
             ORDER BY tp.joined_at ASC, tp.participant_id ASC`,
            [tournamentId]
        );

        const participants = participantsResult.rows.map((row) => row.user_id);

        if (participants.length !== tournament.max_players) {
            fail(400, "El torneo tiene que estar completo para iniciar");
        }

        const orderedPlayers = shuffle(participants);

        await client.query(
            `UPDATE tournaments
             SET status = 'active',
                 started_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE tournament_id = $1`,
            [tournamentId]
        );

        for (let i = 0; i < orderedPlayers.length; i += 2) {
            await client.query(
                `INSERT INTO tournament_matches (
                    tournament_id,
                    round_number,
                    match_order,
                    player1_id,
                    player2_id,
                    status
                 )
                 VALUES ($1, 1, $2, $3, $4, 'ready')`,
                [tournamentId, i / 2 + 1, orderedPlayers[i], orderedPlayers[i + 1]]
            );
        }

        return getTournamentSnapshot(tournamentId, userId, client);
    });
}

async function setMatchResult(tournamentId, matchId, winnerUserId, userId) {
    return withTransaction(async (client) => {
        const tournament = await getTournamentForUpdate(client, tournamentId);

        ensureCreator(tournament, userId);

        if (tournament.status !== "active") {
            fail(400, "El torneo no esta activo");
        }

        const matchResult = await client.query(
            `SELECT *
             FROM tournament_matches
             WHERE tournament_id = $1 AND tournament_match_id = $2
             FOR UPDATE`,
            [tournamentId, matchId]
        );

        if (matchResult.rows.length === 0) {
            fail(404, "Cruce no encontrado");
        }

        const match = matchResult.rows[0];

        if (match.status === "finished") {
            fail(400, "Este cruce ya tiene ganador");
        }

        const cleanWinnerUserId = Number(winnerUserId);

        if (
            cleanWinnerUserId !== Number(match.player1_id) &&
            cleanWinnerUserId !== Number(match.player2_id)
        ) {
            fail(400, "El ganador debe ser uno de los jugadores del cruce");
        }

        const loserUserId =
            cleanWinnerUserId === Number(match.player1_id)
                ? match.player2_id
                : match.player1_id;

        await client.query(
            `UPDATE tournament_matches
             SET winner_user_id = $1,
                 status = 'finished',
                 updated_at = CURRENT_TIMESTAMP
             WHERE tournament_match_id = $2`,
            [cleanWinnerUserId, matchId]
        );

        if (loserUserId) {
            await client.query(
                `UPDATE tournament_participants
                 SET eliminated = TRUE
                 WHERE tournament_id = $1 AND user_id = $2`,
                [tournamentId, loserUserId]
            );
        }

        const totalRounds = Math.log2(tournament.max_players);

        if (match.round_number >= totalRounds) {
            await client.query(
                `UPDATE tournament_participants
                 SET eliminated = FALSE
                 WHERE tournament_id = $1 AND user_id = $2`,
                [tournamentId, cleanWinnerUserId]
            );

            await client.query(
                `UPDATE tournaments
                 SET status = 'finished',
                     winner_user_id = $1,
                     finished_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE tournament_id = $2`,
                [cleanWinnerUserId, tournamentId]
            );

            return getTournamentSnapshot(tournamentId, userId, client);
        }

        const nextRound = match.round_number + 1;
        const nextOrder = Math.ceil(match.match_order / 2);
        const slotColumn = match.match_order % 2 === 1 ? "player1_id" : "player2_id";

        const nextMatchResult = await client.query(
            `SELECT *
             FROM tournament_matches
             WHERE tournament_id = $1
               AND round_number = $2
               AND match_order = $3
             FOR UPDATE`,
            [tournamentId, nextRound, nextOrder]
        );

        if (nextMatchResult.rows.length === 0) {
            await client.query(
                `INSERT INTO tournament_matches (
                    tournament_id,
                    round_number,
                    match_order,
                    ${slotColumn},
                    status
                 )
                 VALUES ($1, $2, $3, $4, 'pending')`,
                [tournamentId, nextRound, nextOrder, cleanWinnerUserId]
            );
        } else {
            await client.query(
                `UPDATE tournament_matches
                 SET ${slotColumn} = $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE tournament_match_id = $2`,
                [cleanWinnerUserId, nextMatchResult.rows[0].tournament_match_id]
            );
        }

        await client.query(
            `UPDATE tournament_matches
             SET status = 'ready',
                 updated_at = CURRENT_TIMESTAMP
             WHERE tournament_id = $1
               AND round_number = $2
               AND match_order = $3
               AND player1_id IS NOT NULL
               AND player2_id IS NOT NULL
               AND status <> 'finished'`,
            [tournamentId, nextRound, nextOrder]
        );

        await client.query(
            "UPDATE tournaments SET updated_at = CURRENT_TIMESTAMP WHERE tournament_id = $1",
            [tournamentId]
        );

        return getTournamentSnapshot(tournamentId, userId, client);
    });
}

module.exports = {
    ServiceError,
    listTournaments,
    getTournamentSnapshot,
    createTournament,
    updateTournament,
    joinTournament,
    joinTournamentByCode,
    leaveTournament,
    deleteTournament,
    startTournament,
    setMatchResult,
};
