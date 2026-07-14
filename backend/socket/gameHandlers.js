const { findRoomByUser } = require("./roomManager");
const { generateQuestions } = require("./questionGenerator");
const { saveMatchResults } = require("./matchRepository");
const { advanceTournamentMatch } = require("../services/tournamentsService");
const {
    consumeInventoryItem,
    getLatestScreamerImageForUser,
    getPurchasedPowerupsForUser,
} = require("../services/storeService");

const MAX_LIVES = 3;

// ── Config de power-ups y partida (configurables por env) ──
const MATCH_DURATION_MS = Number(process.env.MATCH_DURATION_MS) || 5 * 60 * 1000; // 5 min
const FREEZE_DURATION_MS = Number(process.env.FREEZE_DURATION_MS) || 10000;       // 10 s
const SCREAMER_DURATION_MS = Number(process.env.SCREAMER_DURATION_MS) || 6500;    // 6.5 s
const STREAK_FOR_EXTRA_LIFE = Number(process.env.STREAK_FOR_EXTRA_LIFE) || 10;

const DEFAULT_POWERUPS = { fiftyFifty: 1, freeze: 1, screamer: 0 };
const EMPTY_POWERUPS = { fiftyFifty: 0, freeze: 0, screamer: 0 };
const POWERUP_INVENTORY_ITEMS = {
    fifty_fifty: {
        key: "fiftyFifty",
        itemId: "fifty-fifty",
        defaultAmount: DEFAULT_POWERUPS.fiftyFifty,
        emptyMessage: "No te queda 50/50",
    },
    freeze: {
        key: "freeze",
        itemId: "freeze",
        defaultAmount: DEFAULT_POWERUPS.freeze,
        emptyMessage: "No te queda congelar",
    },
    screamer: {
        key: "screamer",
        itemId: "screamer",
        defaultAmount: DEFAULT_POWERUPS.screamer,
        emptyMessage: "No te queda screamer",
    },
};

function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// Normaliza una respuesta escrita: minúsculas, sin espacios extra, sin tildes
function normalizeAnswer(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
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
        iso: question.iso,
    };
}

// Progreso de un jugador, para mostrarle a la sala
function playerProgress(player) {
    return {
        userId: player.userId,
        username: player.username,
        avatar: player.avatar || null,
        correctCount: player.correctCount,
        wrongCount: player.wrongCount,
        lives: player.lives,
        currentIndex: player.currentIndex,
        finished: player.finished,
        correctStreak: player.correctStreak ?? 0,
        powerups: { ...EMPTY_POWERUPS, ...(player.powerups || {}) },
        powerupsUsed: { ...EMPTY_POWERUPS, ...(player.powerupsUsed || {}) },
        frozenUntil: player.frozenUntil ?? 0,
        screamerUntil: player.screamerUntil ?? 0,
        screamerImageId: player.activeScreamerImageId ?? "screamer",
        screamerImageSrc: player.activeScreamerImageSrc ?? "/images/paises/screamer.jpg",
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

async function consumePurchasedPowerupIfNeeded(player, type) {
    const powerup = POWERUP_INVENTORY_ITEMS[type];

    if (!powerup) {
        return { ok: false, error: "Power-up desconocido" };
    }

    const usedBefore = Number(player.powerupsUsed?.[powerup.key]) || 0;

    if (usedBefore < powerup.defaultAmount) {
        return { ok: true };
    }

    const result = await consumeInventoryItem(
        player.userId,
        "abilities",
        powerup.itemId
    );

    if (!result.ok) {
        player.powerups[powerup.key] = Math.max(0, powerup.defaultAmount - usedBefore);
        return { ok: false, error: powerup.emptyMessage };
    }

    return { ok: true, remainingPurchased: result.quantity };
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

// En un torneo no puede haber empate (la llave necesita un ganador).
// Si hubo empate, desempata por menos errores y, si siguen iguales, al azar.
function resolveTournamentWinner(gameOver) {
    if (gameOver.winnerUserId) return gameOver.winnerUserId;

    const [a, b] = gameOver.players;
    if (!a || !b) return a?.userId ?? b?.userId ?? null;
    if (a.wrongCount < b.wrongCount) return a.userId;
    if (b.wrongCount < a.wrongCount) return b.userId;
    return Math.random() < 0.5 ? a.userId : b.userId;
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

    // Si la sala era de un torneo, avanzar la llave sola
    if (room.tournament) {
        const winner = resolveTournamentWinner(gameOver);
        if (winner) {
            advanceTournamentMatch(room.tournament.tournamentMatchId, winner)
                .then(() => {
                    io.to(room.code).emit("tournament:matchEnded", {
                        tournamentId: room.tournament.tournamentId,
                    });
                })
                .catch((e) => console.error("Error avanzando torneo:", e));
        }
    }
}

// Arranca la partida solo desde el boton manual casual o desde un cruce de torneo.
async function startGame(io, room, { source } = {}) {
    if (room.status !== "waiting") return; // ya arrancó
    if (!room.tournament && source !== "manual") return;
    if (room.tournament && source !== "tournament") return;

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
        player.correctStreak = 0;
        const purchasedPowerups = await getPurchasedPowerupsForUser(player.userId);
        player.powerups = {
            fiftyFifty: DEFAULT_POWERUPS.fiftyFifty + purchasedPowerups.fiftyFifty,
            freeze: DEFAULT_POWERUPS.freeze + purchasedPowerups.freeze,
            screamer: DEFAULT_POWERUPS.screamer + purchasedPowerups.screamer,
        };
        const screamerImage = await getLatestScreamerImageForUser(player.userId);
        player.selectedScreamerImageId = screamerImage.id;
        player.selectedScreamerImageSrc = screamerImage.src;
        player.activeScreamerImageId = "screamer";
        player.activeScreamerImageSrc = "/images/paises/screamer.jpg";
        player.frozenUntil = 0;
        player.screamerUntil = 0;
        player.powerupsUsed = { ...EMPTY_POWERUPS };
        player.extraLivesAwarded = 0;
    }

    room.matchTimer = setTimeout(() => {
        finishGame(io, room, buildGameOver(room));
    }, MATCH_DURATION_MS);

    io.to(room.code).emit("game:started", {
        totalQuestions: questions.length,
        question: publicQuestion(questions[0]),
        matchEndsAt: room.matchEndsAt,
        players: Array.from(room.players.values()).map(playerProgress),
    });

    console.log(`Partida iniciada en sala ${room.code}`);
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
            if (room.tournament) {
                return callback?.({
                    error: "Las partidas de torneo empiezan automaticamente",
                });
            }
            if (room.status !== "waiting") {
                return callback?.({ error: "La partida ya empezó o terminó" });
            }
            if (room.players.size < 2) {
                return callback?.({ error: "Faltan jugadores" });
            }

            await startGame(io, room, { source: "manual" });
            callback?.({ ok: true });
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

            // Power-up del rival: si estás congelado o con screamer no podés responder
            const now = Date.now();
            if (now < (player.frozenUntil || 0)) {
                return callback?.({
                    error: "Estás congelado",
                    frozenUntil: player.frozenUntil,
                });
            }
            if (now < (player.screamerUntil || 0)) {
                return callback?.({
                    error: "El screamer está bloqueando tu pantalla",
                    screamerUntil: player.screamerUntil,
                });
            }

            // Anti-trampa: tiene que responder SU pregunta actual
            if (Number(index) !== player.currentIndex) {
                return callback?.({ error: "Pregunta inválida" });
            }

            const question = room.questions[player.currentIndex];
            const isCorrect =
                room.mode === "country-by-map"
                    ? normalizeAnswer(option) === normalizeAnswer(question.correctValue)
                    : option === question.correctValue;

            // En online ya no hay vidas: nadie se elimina por errar.
            // La racha es solo informativa (infinita, sin power-ups).
            if (isCorrect) {
                player.correctCount += 1;
                player.correctStreak += 1;
            } else {
                player.wrongCount += 1;
                player.correctStreak = 0;
            }

            player.currentIndex += 1;

            const noQuestions = player.currentIndex >= room.questions.length;
            // Se gana por terminar primero todas las preguntas, o por tiempo.
            const finishedAlive = noQuestions;

            if (noQuestions) {
                player.finished = true;
            }

            const nextQuestion = player.finished
                ? null
                : publicQuestion(room.questions[player.currentIndex]);

            // Resultado para el jugador que respondió
            callback?.({
                correct: isCorrect,
                correctValue: question.correctValue, // se revela DESPUÉS de responder
                correctCount: player.correctCount,
                wrongCount: player.wrongCount,
                correctStreak: player.correctStreak,
                finished: player.finished,
                nextQuestion,
            });

            // Avisar el progreso a toda la sala
            io.to(room.code).emit("game:progress", playerProgress(player));

            // ── Fin de partida ──
            if (finishedAlive) {
                // Terminó todas las preguntas vivo: gana
                finishGame(io, room, buildGameOver(room, player.userId));
            } else if (allFinished(room)) {
                // Si ambos terminaron por vidas/preguntas, define por progreso.
                finishGame(io, room, buildGameOver(room));
            }
        } catch (error) {
            console.error("Error en game:answer:", error);
            callback?.({ error: "Error del servidor" });
        }
    });

    // ── Usar un power-up (50/50 o congelar rival) ──
    socket.on("game:usePowerup", async (payload, callback) => {
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

            player.powerups = { ...EMPTY_POWERUPS, ...(player.powerups || {}) };
            player.powerupsUsed = { ...EMPTY_POWERUPS, ...(player.powerupsUsed || {}) };

            const now = Date.now();
            if (now < (player.frozenUntil || 0)) {
                return callback?.({ error: "Estás congelado" });
            }
            if (now < (player.screamerUntil || 0)) {
                return callback?.({ error: "El screamer está bloqueando tu pantalla" });
            }

            // ── 50/50: el server elimina 2 opciones incorrectas ──
            if (type === "fifty_fifty") {
                if (room.mode === "country-by-map") {
                    return callback?.({ error: "El 50/50 no está disponible en este modo" });
                }
                if (!player.powerups || player.powerups.fiftyFifty <= 0) {
                    return callback?.({ error: "No te queda 50/50" });
                }

                const question = room.questions[player.currentIndex];
                if (!question) {
                    return callback?.({ error: "No hay pregunta activa" });
                }

                const wrongIndices = question.options
                    .map((opt, i) => (opt !== question.correctValue ? i : -1))
                    .filter((i) => i !== -1);

                const removedIndices = shuffle(wrongIndices).slice(0, 2);

                const consumedPowerup = await consumePurchasedPowerupIfNeeded(
                    player,
                    "fifty_fifty"
                );
                if (!consumedPowerup.ok) {
                    io.to(room.code).emit("game:progress", playerProgress(player));
                    return callback?.({ error: consumedPowerup.error });
                }

                player.powerups.fiftyFifty -= 1;
                player.powerupsUsed.fiftyFifty += 1;

                io.to(room.code).emit("game:progress", playerProgress(player));

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

                const consumedPowerup = await consumePurchasedPowerupIfNeeded(
                    player,
                    "freeze"
                );
                if (!consumedPowerup.ok) {
                    io.to(room.code).emit("game:progress", playerProgress(player));
                    return callback?.({ error: consumedPowerup.error });
                }

                player.powerups.freeze -= 1;
                player.powerupsUsed.freeze += 1;
                rival.frozenUntil = Date.now() + FREEZE_DURATION_MS;

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

            if (type === "screamer") {
                if (!player.powerups || player.powerups.screamer <= 0) {
                    return callback?.({ error: "No te queda screamer" });
                }

                const rival = opponentOf(room, userId);
                if (!rival || rival.finished) {
                    return callback?.({ error: "No hay rival activo para usar screamer" });
                }

                const consumedPowerup = await consumePurchasedPowerupIfNeeded(
                    player,
                    "screamer"
                );
                if (!consumedPowerup.ok) {
                    io.to(room.code).emit("game:progress", playerProgress(player));
                    return callback?.({ error: consumedPowerup.error });
                }

                player.powerups.screamer -= 1;
                player.powerupsUsed.screamer += 1;
                rival.screamerUntil = Date.now() + SCREAMER_DURATION_MS;
                rival.activeScreamerImageId = player.selectedScreamerImageId || "screamer";
                rival.activeScreamerImageSrc =
                    player.selectedScreamerImageSrc || "/images/paises/screamer.jpg";

                io.to(room.code).emit("player:screamed", {
                    userId: rival.userId,
                    by: userId,
                    screamerUntil: rival.screamerUntil,
                    screamerImageId: rival.activeScreamerImageId,
                    screamerImageSrc: rival.activeScreamerImageSrc,
                    durationMs: SCREAMER_DURATION_MS,
                });

                io.to(room.code).emit("game:progress", playerProgress(player));

                return callback?.({
                    ok: true,
                    type: "screamer",
                    screamerUntil: rival.screamerUntil,
                    screamerImageId: rival.activeScreamerImageId,
                    screamerImageSrc: rival.activeScreamerImageSrc,
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
module.exports.startGame = startGame;
