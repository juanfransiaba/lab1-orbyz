import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import OfflineGameLayout from "../components/OfflineGameLayout.jsx";
import { getRandomCountries } from "../../../services/AdminService.js";

function shuffle(arr) {
    const cloned = [...arr];

    for (let index = cloned.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [cloned[index], cloned[randomIndex]] = [
            cloned[randomIndex],
            cloned[index],
        ];
    }

    return cloned;
}

function dedupeCountries(countries) {
    const seen = new Set();

    return countries.filter((country) => {
        const key = String(
            country?.id ?? country?.id_pais ?? country?.nombre ?? ""
        ).toLowerCase();

        if (!key || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function pickOptions(correctCountry, bank) {
    const others = bank.filter((country) => country.id !== correctCountry.id);
    const distractors = shuffle(others).slice(0, 3);

    return shuffle([correctCountry, ...distractors]);
}

function CapitalByCountry() {
    const navigate = useNavigate();

    const poolRef = useRef([]);
    const bankRef = useRef([]);

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

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setError("");

            try {
                const all = await getRandomCountries(300);
                const valid = dedupeCountries(
                    all.filter((country) => country.nombre && country.capital)
                );

                if (valid.length < 4) {
                    throw new Error("No hay suficientes paises validos.");
                }

                bankRef.current = valid;
                poolRef.current = shuffle([...valid]);

                setTotalRounds(valid.length);
                setInitialized(true);
            } catch (err) {
                setError(err.message || "No se pudo cargar el juego.");
                setLoading(false);
            }
        };

        void init();
    }, []);

    const nextRound = useCallback(() => {
        setSelectedOption(null);
        setCorrectOption(null);
        setFeedback("");
        setError("");

        if (poolRef.current.length === 0) {
            setResultState("completed");
            setGameOver(true);
            setLoading(false);
            return;
        }

        setLoading(true);

        const correctCountry = poolRef.current.shift();
        const options = pickOptions(correctCountry, bankRef.current);

        setRoundNumber((currentRound) => currentRound + 1);
        setRound({
            prompt: `${correctCountry.nombre}`,
            imageSrc: correctCountry.imagen_pais,
            imageAlt: `Referencia visual de ${correctCountry.nombre}`,
            options: options.map((country) => ({
                id: country.id,
                value: country.capital,
                label: country.capital,
            })),
            correctValue: correctCountry.capital,
        });

        setLoading(false);
    }, []);

    useEffect(() => {
        if (initialized) {
            nextRound();
        }
    }, [initialized, nextRound]);

    function handleSelectOption(option) {
        if (!round || selectedOption || gameOver) {
            return;
        }

        const isCorrect = option === round.correctValue;

        setSelectedOption(option);
        setCorrectOption(round.correctValue);

        if (isCorrect) {
            setCorrectCount((currentCorrect) => currentCorrect + 1);
            setFeedback("Correcto. Es la capital indicada");
            return;
        }

        setWrongCount((currentWrong) => currentWrong + 1);
        setLives((currentLives) => {
            const nextLives = Math.max(currentLives - 1, 0);

            if (nextLives === 0) {
                setResultState("lost");
                setGameOver(true);
            }

            return nextLives;
        });
        setFeedback(`Incorrecto. La respuesta correcta era ${round.correctValue}.`);
    }

    function handleReplay() {
        poolRef.current = shuffle([...bankRef.current]);

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
                title="Capital por pais"
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
                        ? "Jugaste todas las rondas disponibles en este modo."
                        : "La partida termino, pero ya tenes una base mejor para la siguiente."
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
                        ? "Buen trabajo. Cerraste completo el modo capital por pais."
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
            title="Capital por pais"
            progressText={progressText}
            lives={lives}
            maxLives={maxLives}
            prompt={
                loading
                    ? "Cargando..."
                    : error
                    ? "No pudimos preparar esta partida"
                    : round?.prompt ?? "Preparando..."
            }
            imageSrc={!loading && !error ? round?.imageSrc : ""}
            imageAlt={round?.imageAlt}
            options={loading || error ? [] : round?.options ?? []}
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
            onAction={nextRound}
            isActionDisabled={loading || !selectedOption}
        />
    );
}

export default CapitalByCountry;
