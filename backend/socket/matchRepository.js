const pool = require("../db");
const { sendRankingPassedEmail } = require("../utils/mailer");
const { createNotification } = require("../utils/notifications");

// Resultado de un jugador (win / loss / draw) a partir del game over
function resultFor(player, gameOver) {
    if (gameOver.draw) return "draw";
    return gameOver.winnerUserId === player.userId ? "win" : "loss";
}

// Puntos para el ranking: ganar online = 3, empatar = 1, perder = 0
function pointsForResult(result) {
    if (result === "win") return 3;
    if (result === "draw") return 1;
    return 0;
}

// Avisa (mail + campanita) a los amigos que este usuario acaba de superar en el ranking
async function notifyRankingPassed(passerUserId, passerUsername, oldScore, newScore) {
    if (newScore <= oldScore) return;

    try {
        const { rows } = await pool.query(
            `SELECT u.user_id, u.username, u.email, u.score
             FROM users u
             WHERE u.score >= $2 AND u.score < $3
               AND u.user_id IN (
                   SELECT CASE
                              WHEN f.requester_id = $1 THEN f.addressee_id
                              ELSE f.requester_id
                          END
                   FROM friendships f
                   WHERE f.status = 'accepted'
                     AND (f.requester_id = $1 OR f.addressee_id = $1)
               )`,
            [passerUserId, oldScore, newScore]
        );

        for (const friend of rows) {
            // Notificación in-app (campanita)
            createNotification(friend.user_id, "ranking_passed", {
                passerUserId,
                passerUsername,
                newScore,
            });

            // Mail
            if (friend.email) {
                sendRankingPassedEmail({
                    to: friend.email,
                    toUsername: friend.username,
                    passerUsername,
                    newScore,
                }).catch((e) => console.error("Error mandando mail de ranking:", e));
            }
        }
    } catch (error) {
        console.error("Error en notifyRankingPassed:", error);
    }
}

async function saveMatchResults(room, gameOver) {
    const players = gameOver.players;

    if (players.length !== 2) {
        console.warn(`No se guarda la partida ${room.code}: no tiene 2 jugadores`);
        return;
    }

    const totalRounds = room.questions ? room.questions.length : 0;
    const finishedAt = new Date();
    const startedAt = room.startedAt || finishedAt;

    for (const player of players) {
        const opponent = players.find((p) => p.userId !== player.userId);
        const raw = room.players.get(player.userId) || {};

        const metadata = {
            is_online: true,
            room_code: room.code,
            opponent_user_id: opponent.userId,
            opponent_username: opponent.username,
            result: resultFor(player, gameOver),
            powerups: {
                extra_lives_awarded: raw.extraLivesAwarded ?? 0,
                fifty_fifty_used: raw.powerupsUsed?.fiftyFifty ?? 0,
                freeze_used: raw.powerupsUsed?.freeze ?? 0,
            },
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
                    player.userId,
                    room.mode,
                    room.continent || null,
                    player.correctCount,
                    player.correctCount,
                    player.wrongCount,
                    player.currentIndex,
                    totalRounds,
                    player.lives,
                    JSON.stringify(metadata),
                    startedAt,
                    finishedAt,
                ]
            );

            // Sumar puntos de ranking + avisar a quien haya superado
            const points = pointsForResult(metadata.result);
            if (points > 0) {
                const upd = await pool.query(
                    "UPDATE users SET score = score + $1 WHERE user_id = $2 RETURNING score",
                    [points, player.userId]
                );
                const newScore = upd.rows[0].score;
                await notifyRankingPassed(
                    player.userId,
                    player.username,
                    newScore - points,
                    newScore
                );
            }
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
            powerups: {
                extra_lives_awarded: player.extraLivesAwarded ?? 0,
                fifty_fifty_used: player.powerupsUsed?.fiftyFifty ?? 0,
                freeze_used: player.powerupsUsed?.freeze ?? 0,
            },
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
                    player.userId,
                    room.mode,
                    abandoned ? "abandoned" : "completed",
                    room.continent || null,
                    player.correctCount ?? 0,
                    player.correctCount ?? 0,
                    player.wrongCount ?? 0,
                    player.currentIndex ?? 0,
                    totalRounds,
                    player.lives ?? 0,
                    JSON.stringify(metadata),
                    startedAt,
                    finishedAt,
                ]
            );

            // El que no abandonó gana -> +3; el que abandonó, 0
            const points = pointsForResult(metadata.result);
            if (points > 0) {
                const upd = await pool.query(
                    "UPDATE users SET score = score + $1 WHERE user_id = $2 RETURNING score",
                    [points, player.userId]
                );
                const newScore = upd.rows[0].score;
                await notifyRankingPassed(
                    player.userId,
                    player.username,
                    newScore - points,
                    newScore
                );
            }
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