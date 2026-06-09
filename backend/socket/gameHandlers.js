const { findRoomByUser } = require("./roomManager");
const { generateQuestions } = require("./questionGenerator");
const { saveMatchResults } = require("./matchRepository");

const MAX_LIVES = 3;

// ── Config de power-ups y partida (configurables por env) ──
const MATCH_DURATION_MS = Number(process.env.MATCH_DURATION_MS) || 5 * 60 * 1000; // 5 min
const FREEZE_DURATION_MS = Number(process.env.FREEZE_DURATION_MS) || 10000;       // 10 s
const STREAK_FOR_EXTRA_LIFE = Number(process.env.STREAK_FOR_EXTRA_LIFE) || 10;

function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

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
        correctStreak: player.correctStreak ?? 0,
        powerups: player.powerups ?? { fiftyFifty: 0, freeze: 0 },
        powerupsUsed: player.powerupsUsed ?? { fiftyFifty: 0, freeze: 0 },
        frozenUntil: player.frozenUntil ?? 0,
    };
}

function allFinished(room) {
    for (const player of room.players.values()) {
        if (!player.finished) return false;
    }
    return true;
}

function opponentOf(room, userId) {
    for (const p of room.players.values()) {
        if (p.userId !== userId) return p;
    }
    return null;
}

// Arma el game over. Si se pasa winnerUserId explícito (ganó por terminar
// primero o por eliminación) se usa ese; si no, gana el de más correctas.
function buildGameOver(room, explicitWinnerUserId) {
    const players = Array.from(room.players.values()).map(playerProgress);

    let winnerUserId = null;

    if (explicitWinnerUserId !== undefined) {
        winnerUserId = explicitWinnerUserId;
    } else if (players.length === 2) {
        const [a, b] = players;
        if (a.correctCount > b.correctCount) winnerUserId = a.userId;
        else if (b.correctCount > a.correctCount) winnerUserId = b.userId;
        // iguales -> winnerUserId queda null = empate
    }

    return { players, winnerUserId, draw: winnerUserId === null };
}

// Punto ÚNICO de cierre de partida: evita game:over dobles y limpia el timer
function finishGame(io, room, gameOver) {
    if (room.status !== "playing") return; // ya terminó por otro lado

    room.status = "finished";

    if (room.matchTimer) {
        clearTimeout(room.matchTimer);
        room.matchTimer = null;
    }

    io.to(room.code).emit("game:over", gameOver);
    console.log(`Partida terminada en sala ${room.code}`);

    saveMatchResults(room, gameOver).catch((error) =>
        console.error("Error al guardar la partida:", error)
    );
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
            room.matchEndsAt = Date.now() + MATCH_DURATION_MS;

            for (const player of room.players.values()) {
                player.lives = MAX_LIVES;
                player.correctCount = 0;
                player.wrongCount = 0;
                player.currentIndex = 0;
                player.finished = false;
                // power-ups
                player.correctStreak = 0;
                player.powerups = { fiftyFifty: 1, freeze: 1 };
                player.frozenUntil = 0;
                player.powerupsUsed = { fiftyFifty: 0, freeze: 0 };
                player.extraLivesAwarded = 0;
            }

            // Timer de partida: al cumplirse, gana el de más correctas (o empate)
            room.matchTimer = setTimeout(() => {
                finishGame(io, room, buildGameOver(room));
            }, MATCH_DURATION_MS);

            callback?.({ ok: true });

            io.to(room.code).emit("game:started", {
                totalQuestions: questions.length,
                question: publicQuestion(questions[0]),
                matchEndsAt: room.matchEndsAt,
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

            // Power-up del rival: si estás congelado no podés responder
            if (Date.now() < (player.frozenUntil || 0)) {
                return callback?.({
                    error: "Estás congelado",
                    frozenUntil: player.frozenUntil,
                });
            }

            // Anti-trampa: tiene que responder SU pregunta actual
            if (Number(index) !== player.currentIndex) {
                return callback?.({ error: "Pregunta inválida" });
            }

            const question = room.questions[player.currentIndex];
            const isCorrect = option === question.correctValue;

            let extraLife = false;

            if (isCorrect) {
                player.correctCount += 1;
                player.correctStreak += 1;

                // Vida extra cada X correctas seguidas (solo si perdiste vidas)
                if (player.correctStreak >= STREAK_FOR_EXTRA_LIFE) {
                    if (player.lives < MAX_LIVES) {
                        player.lives += 1;
                        player.extraLivesAwarded += 1;
                        extraLife = true;
                    }
                    player.correctStreak = 0; // se reinicia haya dado vida o no
                }
            } else {
                player.wrongCount += 1;
                player.lives -= 1;
                player.correctStreak = 0;
            }

            player.currentIndex += 1;

            const noLives = player.lives <= 0;
            const noQuestions = player.currentIndex >= room.questions.length;
            // terminó la secuencia SIGUIENDO vivo => gana por terminar primero
            const finishedAlive = noQuestions && !noLives;

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
                correctStreak: player.correctStreak,
                extraLife,
                finished: player.finished,
                nextQuestion,
            });

            // Si ganó una vida extra, avisar a la sala
            if (extraLife) {
                io.to(room.code).emit("powerup:awarded", {
                    userId: player.userId,
                    type: "extra_life",
                    lives: player.lives,
                });
            }

            // Avisar el progreso a toda la sala
            io.to(room.code).emit("game:progress", playerProgress(player));

            // ── Fin de partida ──
            if (finishedAlive) {
                // Terminó todas las preguntas vivo: gana
                finishGame(io, room, buildGameOver(room, player.userId));
            } else if (noLives) {
                // [Opción A] Se quedó sin vidas: gana el rival (eliminación)
                const rival = opponentOf(room, userId);
                finishGame(io, room, buildGameOver(room, rival ? rival.userId : null));
            } else if (allFinished(room)) {
                // Red de seguridad
                finishGame(io, room, buildGameOver(room));
            }
        } catch (error) {
            console.error("Error en game:answer:", error);
            callback?.({ error: "Error del servidor" });
        }
    });

    // ── Usar un power-up (50/50 o congelar rival) ──
    socket.on("game:usePowerup", (payload, callback) => {
        try {
            const { type } = payload || {};
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
            if (Date.now() < (player.frozenUntil || 0)) {
                return callback?.({ error: "Estás congelado" });
            }

            // ── 50/50: el server elimina 2 opciones incorrectas ──
            if (type === "fifty_fifty") {
                if (!player.powerups || player.powerups.fiftyFifty <= 0) {
                    return callback?.({ error: "No te queda 50/50" });
                }

                const question = room.questions[player.currentIndex];
                if (!question) {
                    return callback?.({ error: "No hay pregunta activa" });
                }

                // Índices de las opciones incorrectas
                const wrongIndices = question.options
                    .map((opt, i) => (opt !== question.correctValue ? i : -1))
                    .filter((i) => i !== -1);

                const removedIndices = shuffle(wrongIndices).slice(0, 2);

                player.powerups.fiftyFifty -= 1;
                player.powerupsUsed.fiftyFifty += 1;

                io.to(room.code).emit("game:progress", playerProgress(player));

                // Solo a quien lo usó; nunca le decimos cuál es la correcta
                return callback?.({
                    ok: true,
                    type: "fifty_fifty",
                    questionIndex: player.currentIndex,
                    removedIndices,
                    powerups: player.powerups,
                });
            }

            // ── Congelar rival ──
            if (type === "freeze") {
                if (!player.powerups || player.powerups.freeze <= 0) {
                    return callback?.({ error: "No te queda congelar" });
                }

                const rival = opponentOf(room, userId);
                if (!rival || rival.finished) {
                    return callback?.({ error: "No hay rival activo para congelar" });
                }

                player.powerups.freeze -= 1;
                player.powerupsUsed.freeze += 1;
                rival.frozenUntil = Date.now() + FREEZE_DURATION_MS;

                // Avisar a la sala quién quedó congelado y hasta cuándo
                io.to(room.code).emit("player:frozen", {
                    userId: rival.userId,
                    by: userId,
                    frozenUntil: rival.frozenUntil,
                    durationMs: FREEZE_DURATION_MS,
                });

                io.to(room.code).emit("game:progress", playerProgress(player));

                return callback?.({
                    ok: true,
                    type: "freeze",
                    frozenUntil: rival.frozenUntil,
                    powerups: player.powerups,
                });
            }

            return callback?.({ error: "Power-up desconocido" });
        } catch (error) {
            console.error("Error en game:usePowerup:", error);
            callback?.({ error: "Error del servidor" });
        }
    });
}

module.exports = registerGameHandlers;