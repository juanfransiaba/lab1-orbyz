const pool = require("../db");

// Resultado de un jugador (win / loss / draw) a partir del game over
function resultFor(player, gameOver) {
    if (gameOver.draw) return "draw";
    return gameOver.winnerUserId === player.userId ? "win" : "loss";
}

async function saveMatchResults(room, gameOver) {
    const players = gameOver.players;

    if (players.length !== 2) {
        console.warn(
            `No se guarda la partida ${room.code}: no tiene 2 jugadores`
        );
        return;
    }

    const totalRounds = room.questions ? room.questions.length : 0;
    const finishedAt = new Date();
    const startedAt = room.startedAt || finishedAt;

    for (const player of players) {
        const opponent = players.find((p) => p.userId !== player.userId);

        // Esto es lo que linkea las 2 filas de la misma partida
        const metadata = {
            is_online: true,
            room_code: room.code,
            opponent_user_id: opponent.userId,
            opponent_username: opponent.username,
            result: resultFor(player, gameOver),
        };

        try {
            await pool.query(
                `INSERT INTO matches
                    (user_id, mode, status, continent, score,
                     correct_count, wrong_count, round_reached, total_rounds,
                     lives_left, metadata, started_at, finished_at, updated_at)
                 VALUES
                    ($1, $2, 'completed', $3, $4,
                     $5, $6, $7, $8,
                     $9, $10, $11, $12, $12)`,
                [
                    player.userId,                   // $1  user_id
                    room.mode,                       // $2  mode
                    room.continent || null,          // $3  continent
                    player.correctCount,             // $4  score
                    player.correctCount,             // $5  correct_count
                    player.wrongCount,               // $6  wrong_count
                    player.currentIndex,             // $7  round_reached
                    totalRounds,                     // $8  total_rounds
                    player.lives,                    // $9  lives_left
                    JSON.stringify(metadata),        // $10 metadata
                    startedAt,                       // $11 started_at
                    finishedAt,                      // $12 finished_at + updated_at
                ]
            );
        } catch (error) {
            console.error(
                `Error guardando la partida del usuario ${player.userId}:`,
                error
            );
        }
    }

    console.log(`Partida ${room.code} guardada en matches (2 filas)`);
}

async function saveAbandonedMatch(room, abandonerUserId) {
    const players = Array.from(room.players.values());

    if (players.length !== 2) {
        console.warn(`No se guarda la partida ${room.code}: no tiene 2 jugadores`);
        return;
    }

    const totalRounds = room.questions ? room.questions.length : 0;
    const finishedAt = new Date();
    const startedAt = room.startedAt || finishedAt;

    for (const player of players) {
        const opponent = players.find((p) => p.userId !== player.userId);
        const abandoned = player.userId === abandonerUserId;

        const metadata = {
            is_online: true,
            room_code: room.code,
            opponent_user_id: opponent.userId,
            opponent_username: opponent.username,
            result: abandoned ? "loss" : "win",
        };

        try {
            await pool.query(
                `INSERT INTO matches
                    (user_id, mode, status, continent, score,
                     correct_count, wrong_count, round_reached, total_rounds,
                     lives_left, metadata, started_at, finished_at, updated_at)
                 VALUES
                    ($1, $2, $3, $4, $5,
                     $6, $7, $8, $9,
                     $10, $11, $12, $13, $13)`,
                [
                    player.userId,                       // $1  user_id
                    room.mode,                           // $2  mode
                    abandoned ? "abandoned" : "completed", // $3  status
                    room.continent || null,              // $4  continent
                    player.correctCount ?? 0,            // $5  score
                    player.correctCount ?? 0,            // $6  correct_count
                    player.wrongCount ?? 0,              // $7  wrong_count
                    player.currentIndex ?? 0,            // $8  round_reached
                    totalRounds,                         // $9  total_rounds
                    player.lives ?? 0,                   // $10 lives_left
                    JSON.stringify(metadata),            // $11 metadata
                    startedAt,                           // $12 started_at
                    finishedAt,                          // $13 finished_at + updated_at
                ]
            );
        } catch (error) {
            console.error(
                `Error guardando partida (abandono) del usuario ${player.userId}:`,
                error
            );
        }
    }

    console.log(`Partida ${room.code} guardada (abandono) en matches`);
}

module.exports = { saveMatchResults, saveAbandonedMatch };