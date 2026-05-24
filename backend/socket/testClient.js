require("dotenv").config();
const { io } = require("socket.io-client");

const tokenA = process.argv[2];
const tokenB = process.argv[3];
const scenario = process.argv[4] || "reconnect"; // "reconnect" o "abandon"

if (!tokenA || !tokenB) {
    console.error(
        "Uso: node socket/testClient.js <TOKEN_A> <TOKEN_B> [reconnect|abandon]"
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
                console.error(`[${label}] error al responder:`, res.error);
                return;
            }
            console.log(
                `[${label}] pregunta ${index}: ${res.correct ? "BIEN" : "MAL"} (vidas ${res.lives})`
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

    socket.on("game:started", ({ question, totalQuestions }) => {
        console.log(`[${label}] partida iniciada (${totalQuestions} preguntas)`);
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

                        // A los 2.5s, B se desconecta
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
                    });
                }, 500);
            });
        }, 800);
    });
});

// Red de seguridad
setTimeout(() => process.exit(0), 90000);