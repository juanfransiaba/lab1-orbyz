require("dotenv").config();
const { io } = require("socket.io-client");

const tokenA = process.argv[2];
const tokenB = process.argv[3];
const scenario = process.argv[4] || "reconnect"; // "reconnect" | "abandon" | "powerups"

if (!tokenA || !tokenB) {
    console.error(
        "Uso: node socket/testClient.js <TOKEN_A> <TOKEN_B> [reconnect|abandon|powerups]"
    );
    process.exit(1);
}

const PORT = process.env.PORT || 3000;
const URL = process.env.SERVER_URL || `http://localhost:${PORT}`;

function pickRandom(options) {
    return options[Math.floor(Math.random() * options.length)];
}

function makePlayer(label, token) {
    const socket = io(URL, { auth: { token } });

    socket.on("connect", () => console.log(`[${label}] conectado: ${socket.id}`));
    socket.on("connect_error", (e) =>
        console.error(`[${label}] error: ${e.message}`)
    );

    socket.on("player:disconnected", (d) =>
        console.log(
            `[${label}] rival desconectado (userId ${d.userId}), ${d.graceMs / 1000}s para volver`
        )
    );
    socket.on("player:reconnected", (d) =>
        console.log(`[${label}] rival reconectado (userId ${d.userId})`)
    );

    // ── Eventos de power-ups ──
    socket.on("powerup:awarded", (d) =>
        console.log(
            `[${label}] POWER-UP: userId ${d.userId} ganó ${d.type} (vidas ${d.lives})`
        )
    );
    socket.on("player:frozen", (d) =>
        console.log(
            `[${label}] CONGELADO: userId ${d.userId} por ${d.durationMs / 1000}s (lo congeló ${d.by})`
        )
    );

    socket.on("game:reconnected", (state) => {
        console.log(`[${label}] RECONECTADO a la partida ${state.room.code}`);
        if (state.question) {
            answer(state.question.index, state.question.options);
        }
    });

    socket.on("game:abandoned", (info) => {
        console.log(`[${label}] PARTIDA ABANDONADA por userId ${info.abandonerUserId}`);
        setTimeout(() => process.exit(0), 300);
    });

    socket.on("game:over", (result) => {
        console.log(
            `[${label}] GAME OVER -> ganador: ${result.winnerUserId}, empate: ${result.draw}`
        );
        setTimeout(() => process.exit(0), 300);
    });

    function answer(index, options) {
        if (!socket.connected) return; // no responder si estamos desconectados

        socket.emit("game:answer", { index, option: pickRandom(options) }, (res) => {
            if (res.error) {
                // Si estoy congelado, reintento cuando pase el freeze
                if (res.frozenUntil) {
                    const wait = Math.max(0, res.frozenUntil - Date.now()) + 200;
                    console.log(
                        `[${label}] congelado, reintento la pregunta ${index} en ${Math.ceil(wait / 1000)}s`
                    );
                    setTimeout(() => answer(index, options), wait);
                    return;
                }
                console.error(`[${label}] error al responder:`, res.error);
                return;
            }
            console.log(
                `[${label}] pregunta ${index}: ${res.correct ? "BIEN" : "MAL"} ` +
                `(vidas ${res.lives}, racha ${res.correctStreak})` +
                `${res.extraLife ? " +VIDA EXTRA" : ""}`
            );
            if (res.nextQuestion) {
                setTimeout(
                    () => answer(res.nextQuestion.index, res.nextQuestion.options),
                    800
                );
            } else {
                console.log(`[${label}] terminó su partida`);
            }
        });
    }

    function usePowerup(type) {
        socket.emit("game:usePowerup", { type }, (res) => {
            if (res.error) {
                return console.error(`[${label}] error power-up ${type}:`, res.error);
            }
            if (type === "fifty_fifty") {
                console.log(
                    `[${label}] usó 50/50 -> quita opciones [${res.removedIndices}] ` +
                    `(quedan: 50/50 ${res.powerups.fiftyFifty}, freeze ${res.powerups.freeze})`
                );
            } else {
                console.log(
                    `[${label}] usó FREEZE -> rival congelado ` +
                    `(quedan: 50/50 ${res.powerups.fiftyFifty}, freeze ${res.powerups.freeze})`
                );
            }
        });
    }

    socket.on("game:started", ({ question, totalQuestions, matchEndsAt }) => {
        console.log(
            `[${label}] partida iniciada (${totalQuestions} preguntas, ` +
            `termina ${new Date(matchEndsAt).toLocaleTimeString()})`
        );

        // Escenario power-ups: A usa 50/50 sobre su 1ra pregunta y congela a B
        if (scenario === "powerups" && label === "A") {
            usePowerup("fifty_fifty");
            usePowerup("freeze");
            setTimeout(() => answer(question.index, question.options), 300);
            return;
        }

        answer(question.index, question.options);
    });

    return socket;
}

const playerA = makePlayer("A", tokenA);
const playerB = makePlayer("B", tokenB);

playerA.on("connect", () => {
    playerA.emit("room:create", { mode: "country-by-capital" }, (res) => {
        if (res.error) return console.error("[A] error al crear:", res.error);

        const code = res.room.code;
        console.log(`[A] sala creada: ${code}`);

        setTimeout(() => {
            playerB.emit("room:join", { code }, (res2) => {
                if (res2.error)
                    return console.error("[B] error al unirse:", res2.error);
                console.log(`[B] se unió a ${code}`);

                setTimeout(() => {
                    playerA.emit("game:start", {}, (res3) => {
                        if (res3.error)
                            return console.error("[A] error al empezar:", res3.error);
                        console.log("[A] partida arrancada");

                        // Solo los escenarios de conexión simulan desconexión
                        if (scenario === "reconnect" || scenario === "abandon") {
                            setTimeout(() => {
                                console.log(
                                    `[B] >>> simulando desconexión (escenario: ${scenario}) <<<`
                                );
                                playerB.disconnect();

                                if (scenario === "abandon") {
                                    console.log("[B] >>> NO se reconecta <<<");
                                } else {
                                    setTimeout(() => {
                                        console.log("[B] >>> reconectando <<<");
                                        playerB.connect();
                                    }, 3000);
                                }
                            }, 500);
                        }
                    });
                }, 500);
            });
        }, 800);
    });
});

// Red de seguridad
setTimeout(() => process.exit(0), 90000);