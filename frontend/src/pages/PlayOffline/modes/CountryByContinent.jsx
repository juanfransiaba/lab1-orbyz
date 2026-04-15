import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import OfflineGameLayout from "../components/OfflineGameLayout.jsx";
import { getRandomCountriesByContinent } from "../../../services/AdminService.js";

const CONTINENT_MAP = {
    america: "Americas",
    europa: "Europe",
    asia: "Asia",
    africa: "Africa",
    oceania: "Oceania",
};

const CONTINENT_LABELS = {
    america: "America",
    europa: "Europa",
    asia: "Asia",
    africa: "Africa",
    oceania: "Oceania",
};

function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
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

function CountryByContinent() {
    const navigate = useNavigate();
    const { continent } = useParams();

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

    const continentName = useMemo(
        () => CONTINENT_MAP[continent?.toLowerCase?.() || ""],
        [continent]
    );

    const continentLabel = useMemo(
        () => CONTINENT_LABELS[continent?.toLowerCase?.() || ""],
        [continent]
    );

    useEffect(() => {
        const init = async () => {
            if (!continentName) {
                return;
            }

            setLoading(true);
            setError("");

            try {
                const all = await getRandomCountriesByContinent(continentName, 100);
                const valid = dedupeCountries(
                    all.filter(
                        (country) =>
                            country.nombre && country.capital && country.imagen_pais
                    )
                );

                if (valid.length < 4) {
                    throw new Error(
                        "No hay suficientes paises disponibles para este continente."
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
    }, [continentName]);

    const loadRound = useCallback(() => {
        setLoading(true);
        setError("");
        setSelectedOption(null);
        setCorrectOption(null);
        setFeedback("");

        if (poolRef.current.length === 0) {
            setResultState("completed");
            setGameOver(true);
            setLoading(false);
            return;
        }

        const correctCountry = poolRef.current.shift();
        const others = bankRef.current.filter(
            (country) => country.id !== correctCountry.id
        );
        const distractors = shuffle(others).slice(0, 3);
        const finalOptions = shuffle([correctCountry, ...distractors]);

        setRoundNumber((currentRound) => currentRound + 1);

        setRound({
            prompt: `${correctCountry.capital}`,
            imageSrc: correctCountry.imagen_pais,
            imageAlt: `Referencia visual de ${correctCountry.nombre}`,
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
    }, [initialized, loadRound]);

    if (!continentName) {
        return <Navigate to="/offline/continent-selection" replace />;
    }

    function handleSelectOption(option) {
        if (!round || selectedOption || gameOver) {
            return;
        }

        const isCorrect = option === round.correctValue;

        setSelectedOption(option);
        setCorrectOption(round.correctValue);

        if (isCorrect) {
            setCorrectCount((currentCorrect) => currentCorrect + 1);
            setFeedback(`Correcto. ${option} pertenece a ${continentName}.`);
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
                title="Pais por continente"
                promptLabel={continentLabel || "Continente"}
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
                        ? `Terminaste todas las rondas disponibles para ${continentLabel || "este continente"}.`
                        : `Se cerro la partida de ${continentLabel || "este continente"}, pero ya acumulaste buena practica.`
                }
                resultStats={[
                    { label: "Continente", value: continentLabel || "-" },
                    { label: "Aciertos", value: correctCount },
                    { label: "Errores", value: wrongCount },
                    { label: "Precision", value: `${accuracy}%` },
                ]}
                isResultScreen
                resultVariant={resultState === "completed" ? "success" : "error"}
                feedback={
                    resultState === "completed"
                        ? `Muy buena partida. Cerraste completo el recorrido de ${continentLabel || "este continente"}.`
                        : `Llegaste hasta la ronda ${roundNumber}. Aciertos: ${correctCount}.`
                }
                feedbackTone={resultState === "completed" ? "success" : "error"}
                onBack={() => navigate("/offline/continent-selection")}
                actionLabel="Jugar de nuevo"
                onAction={handleReplay}
            />
        );
    }

    return (
        <OfflineGameLayout
            title="Pais por continente"
            promptLabel={continentLabel || "Continente"}
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
            onBack={() => navigate("/offline/continent-selection")}
            actionLabel={
                poolRef.current.length === 0 && selectedOption
                    ? "Finalizar"
                    : "Siguiente"
            }
            onAction={loadRound}
            isActionDisabled={loading || !selectedOption}
        />
    );
}

export default CountryByContinent;
