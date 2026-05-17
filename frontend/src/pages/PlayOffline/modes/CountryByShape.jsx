import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import OfflineGameLayout from "../components/OfflineGameLayout.jsx";
import { getCountries } from "../../../services/AdminService.js";
import { createMatch, updateMatch } from "../../../services/MatchService.js";

function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
}

function normalizeKey(value) {
    return String(value || "").trim().toLowerCase();
}

function getCountryIdentity(country) {
    return normalizeKey(country?.id ?? country?.id_pais ?? country?.nombre);
}

function getPromptIdentity(country) {
    return normalizeKey(country?.nombre);
}

function dedupeCountries(countries, getKey) {
    const seen = new Set();

    return countries.filter((country) => {
        const key = getKey(country);

        if (!key || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function CountryByShape() {
    const navigate = useNavigate();

    const poolRef = useRef([]);
    const bankRef = useRef([]);
    const matchIdRef = useRef(null);
    const matchPromiseRef = useRef(null);

    const [initialized, setInitialized] = useState(false);
    const [round, setRound] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [correctOption, setCorrectOption] = useState(null);
    const [feedback, setFeedback] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [roundNumber, setRoundNumber] = useState(0);
    const [totalRounds, setTotalRounds] = useState(0);

    const [correctCount, setCorrectCount] = useState(0);
    const [wrongCount, setWrongCount] = useState(0);
    const [lives, setLives] = useState(3);
    const [gameOver, setGameOver] = useState(false);
    const [resultState, setResultState] = useState("lost");

    const maxLives = 3;

    const ensureMatchStarted = useCallback(async () => {
        if (matchIdRef.current) {
            return matchIdRef.current;
        }

        if (matchPromiseRef.current) {
            return matchPromiseRef.current;
        }

        matchPromiseRef.current = createMatch({
            mode: "country-by-shape",
            total_rounds: bankRef.current.length || totalRounds,
            lives_left: maxLives,
            metadata: {
                title: "Pais por silueta",
            },
        })
            .then((match) => {
                matchIdRef.current = match.id;
                return match.id;
            })
            .catch(() => null)
            .finally(() => {
                matchPromiseRef.current = null;
            });

        return matchPromiseRef.current;
    }, [totalRounds]);

    const syncMatchProgress = useCallback(
        async ({
            nextCorrectCount = correctCount,
            nextWrongCount = wrongCount,
            nextLives = lives,
            nextRoundNumber = roundNumber,
            status = "ongoing",
            metadata = {},
        } = {}) => {
            const matchId = await ensureMatchStarted();

            if (!matchId) {
                return;
            }

            try {
                await updateMatch(matchId, {
                    status,
                    score: nextCorrectCount,
                    correct_count: nextCorrectCount,
                    wrong_count: nextWrongCount,
                    round_reached: nextRoundNumber,
                    total_rounds: totalRounds || bankRef.current.length,
                    lives_left: nextLives,
                    metadata,
                });
            } catch {
                // no-op
            }
        },
        [correctCount, ensureMatchStarted, lives, roundNumber, totalRounds, wrongCount]
    );

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setError("");

            try {
                const countries = await getCountries();
                const valid = dedupeCountries(
                    countries.filter(
                        (country) => country.nombre && country.imagen_silueta
                    ),
                    getPromptIdentity
                );

                if (valid.length < 4) {
                    throw new Error(
                        "No hay suficientes paises con silueta disponible para este modo."
                    );
                }

                bankRef.current = valid;
                poolRef.current = shuffle(valid);

                setTotalRounds(valid.length);
                setInitialized(true);
            } catch (err) {
                setError(err.message || "No se pudo cargar el juego.");
                setLoading(false);
            }
        };

        void init();
    }, []);

    const loadRound = useCallback(() => {
        setLoading(true);
        setError("");
        setSelectedOption(null);
        setCorrectOption(null);
        setFeedback("");

        if (poolRef.current.length === 0) {
            void syncMatchProgress({
                status: "completed",
                metadata: { resultState: "completed" },
            });
            setResultState("completed");
            setGameOver(true);
            setLoading(false);
            return;
        }

        const correctCountry = poolRef.current.shift();
        const others = bankRef.current.filter(
            (country) => getCountryIdentity(country) !== getCountryIdentity(correctCountry)
        );
        const distractors = shuffle(others).slice(0, 3);
        const finalOptions = shuffle([correctCountry, ...distractors]);

        setRoundNumber((currentRound) => currentRound + 1);
        void ensureMatchStarted();

        setRound({
            prompt: "Que pais corresponde a esta silueta?",
            imageSrc: correctCountry.imagen_silueta,
            imageAlt: `Silueta de ${correctCountry.nombre}`,
            options: finalOptions.map((country) => ({
                id: country.id,
                value: country.nombre,
                label: country.nombre,
            })),
            correctValue: correctCountry.nombre,
        });

        setLoading(false);
    }, []);

    useEffect(() => {
        if (initialized) {
            loadRound();
        }
    }, [initialized]);

    function handleSelectOption(option) {
        if (!round || selectedOption || gameOver) {
            return;
        }

        const isCorrect = option === round.correctValue;

        setSelectedOption(option);
        setCorrectOption(round.correctValue);

        if (isCorrect) {
            const nextCorrectCount = correctCount + 1;

            setCorrectCount(nextCorrectCount);
            setFeedback("Correcto. Reconociste la silueta.");
            void syncMatchProgress({
                nextCorrectCount,
            });
            return;
        }

        const nextWrongCount = wrongCount + 1;
        const nextLives = Math.max(lives - 1, 0);

        setWrongCount(nextWrongCount);
        setLives(() => {
            if (nextLives === 0) {
                setResultState("lost");
                setGameOver(true);
            }

            return nextLives;
        });

        void syncMatchProgress({
            nextWrongCount,
            nextLives,
            status: nextLives === 0 ? "completed" : "ongoing",
            metadata: nextLives === 0 ? { resultState: "lost" } : {},
        });
        setFeedback(`Incorrecto. La respuesta correcta era ${round.correctValue}.`);
    }

    function handleReplay() {
        poolRef.current = shuffle([...bankRef.current]);
        matchIdRef.current = null;
        matchPromiseRef.current = null;

        setCorrectCount(0);
        setWrongCount(0);
        setLives(maxLives);
        setRoundNumber(0);
        setGameOver(false);
        setResultState("lost");
        setRound(null);
        setSelectedOption(null);
        setCorrectOption(null);
        setFeedback("");
        setLoading(true);
        setInitialized(false);

        setTimeout(() => setInitialized(true), 0);
    }

    const progressText = totalRounds > 0 ? `${roundNumber}/${totalRounds}` : "0/0";
    const answeredRounds = correctCount + wrongCount;
    const accuracy = answeredRounds
        ? Math.round((correctCount / answeredRounds) * 100)
        : 0;

    if (gameOver) {
        return (
            <OfflineGameLayout
                title="Pais por silueta"
                progressText={progressText}
                lives={lives}
                maxLives={maxLives}
                prompt={
                    resultState === "completed"
                        ? "Completaste la partida"
                        : "Te quedaste sin vidas"
                }
                resultSubtitle={
                    resultState === "completed"
                        ? "Terminaste todas las rondas del modo por silueta."
                        : "La partida termino, pero ya entrenaste bastante el reconocimiento visual."
                }
                resultStats={[
                    { label: "Rondas jugadas", value: answeredRounds },
                    { label: "Aciertos", value: correctCount },
                    { label: "Errores", value: wrongCount },
                    { label: "Precision", value: `${accuracy}%` },
                ]}
                isResultScreen
                resultVariant={resultState === "completed" ? "success" : "error"}
                feedback={
                    resultState === "completed"
                        ? "Excelente. Superaste todo el recorrido de siluetas."
                        : `Llegaste hasta la ronda ${roundNumber}. Aciertos: ${correctCount}.`
                }
                feedbackTone={resultState === "completed" ? "success" : "error"}
                onBack={() => navigate("/offline")}
                actionLabel="Jugar de nuevo"
                onAction={handleReplay}
            />
        );
    }

    return (
        <OfflineGameLayout
            title="Pais por silueta"
            progressText={progressText}
            lives={lives}
            maxLives={maxLives}
            prompt={
                loading
                    ? "Cargando nueva ronda..."
                    : error
                    ? "No pudimos preparar esta partida"
                    : round?.prompt || "Preparando desafio..."
            }
            imageSrc={!loading && !error ? round?.imageSrc : ""}
            imageAlt={round?.imageAlt}
            options={loading || error ? [] : round?.options || []}
            onSelectOption={handleSelectOption}
            selectedOption={selectedOption}
            correctOption={correctOption}
            feedback={
                loading
                    ? "Estamos preparando las opciones..."
                    : error
                    ? error
                    : feedback
            }
            feedbackTone={error ? "error" : undefined}
            onBack={() => navigate("/offline")}
            actionLabel={
                poolRef.current.length === 0 && selectedOption
                    ? "Finalizar"
                    : "Siguiente"
            }
            onAction={loadRound}
            isActionDisabled={loading || !selectedOption}
            imageFit="contain"
        />
    );
}

export default CountryByShape;
