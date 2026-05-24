const { findRoomByUser } = require("./roomManager");
const { generateQuestions } = require("./questionGenerator");
const { saveMatchResults } = require("./matchRepository");

const MAX_LIVES = 3;

// Versión de la pregunta SIN la respuesta correcta (lo que ve el cliente)
function publicQuestion(question) {
    if (!question) return null;
    return {
        index: question.index,
        prompt: question.prompt,
        imageSrc: question.imageSrc,
        imageAlt: question.imageAlt,
        options: question.options,
    };
}

// Progreso de un jugador, para mostrarle a la sala
function playerProgress(player) {
    return {
        userId: player.userId,
        username: player.username,
        correctCount: player.correctCount,
        wrongCount: player.wrongCount,
        lives: player.lives,
        currentIndex: player.currentIndex,
        finished: player.finished,
    };
}

function allFinished(room) {
    for (const player of room.players.values()) {
        if (!player.finished) return false;
    }
    return true;
}

function buildGameOver(room) {
    const players = Array.from(room.players.values()).map(playerProgress);

    let winnerUserId = null;
    if (players.length === 2) {
        const [a, b] = players;
        if (a.correctCount > b.correctCount) winnerUserId = a.userId;
        else if (b.correctCount > a.correctCount) winnerUserId = b.userId;
        // iguales -> winnerUserId queda null = empate
    }

    return { players, winnerUserId, draw: winnerUserId === null };
}

function registerGameHandlers(io, socket) {
    const userId = socket.user.user_id;

    // ── Empezar la partida (solo el host) ──
    socket.on("game:start", async (payload, callback) => {
        try {
            const room = findRoomByUser(userId);

            if (!room) {
                return callback?.({ error: "No estás en ninguna sala" });
            }
            if (room.hostUserId !== userId) {
                return callback?.({ error: "Solo el host puede empezar la partida" });
            }
            if (room.status !== "waiting") {
                return callback?.({ error: "La partida ya empezó o terminó" });
            }
            if (room.players.size < 2) {
                return callback?.({ error: "Faltan jugadores" });
            }

            const questions = await generateQuestions(room.mode, room.continent);

            room.status = "playing";
            room.questions = questions;
            room.startedAt = new Date();

            for (const player of room.players.values()) {
                player.lives = MAX_LIVES;
                player.correctCount = 0;
                player.wrongCount = 0;
                player.currentIndex = 0;
                player.finished = false;
            }

            callback?.({ ok: true });

            // Los dos arrancan con la misma primera pregunta
            io.to(room.code).emit("game:started", {
                totalQuestions: questions.length,
                question: publicQuestion(questions[0]),
            });

            console.log(`Partida iniciada en sala ${room.code}`);
        } catch (error) {
            console.error("Error en game:start:", error);
            callback?.({ error: error.message || "Error del servidor" });
        }
    });

    // ── Responder una pregunta ──
    socket.on("game:answer", (payload, callback) => {
        try {
            const { index, option } = payload || {};
            const room = findRoomByUser(userId);

            if (!room || room.status !== "playing") {
                return callback?.({ error: "No hay una partida en curso" });
            }

            const player = room.players.get(userId);
            if (!player) {
                return callback?.({ error: "No estás en esta partida" });
            }
            if (player.finished) {
                return callback?.({ error: "Ya terminaste tu partida" });
            }

            // Anti-trampa: tiene que responder SU pregunta actual
            if (Number(index) !== player.currentIndex) {
                return callback?.({ error: "Pregunta inválida" });
            }

            const question = room.questions[player.currentIndex];
            const isCorrect = option === question.correctValue;

            if (isCorrect) {
                player.correctCount += 1;
            } else {
                player.wrongCount += 1;
                player.lives -= 1;
            }

            player.currentIndex += 1;

            const noLives = player.lives <= 0;
            const noQuestions = player.currentIndex >= room.questions.length;

            if (noLives || noQuestions) {
                player.finished = true;
            }

            const nextQuestion = player.finished
                ? null
                : publicQuestion(room.questions[player.currentIndex]);

            // Resultado para el jugador que respondió
            callback?.({
                correct: isCorrect,
                correctValue: question.correctValue, // se revela DESPUÉS de responder
                lives: player.lives,
                correctCount: player.correctCount,
                wrongCount: player.wrongCount,
                finished: player.finished,
                nextQuestion,
            });

            // Avisar el progreso a toda la sala
            io.to(room.code).emit("game:progress", playerProgress(player));

            // ¿Terminaron los dos?
            if (allFinished(room)) {
                room.status = "finished";

                const gameOver = buildGameOver(room);
                io.to(room.code).emit("game:over", gameOver);
                console.log(`Partida terminada en sala ${room.code}`);

                saveMatchResults(room, gameOver).catch((error) =>
                    console.error("Error al guardar la partida:", error)
                );
            }
        } catch (error) {
            console.error("Error en game:answer:", error);
            callback?.({ error: "Error del servidor" });
        }
    });
}

module.exports = registerGameHandlers;