import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import OfflineGameLayout from "../components/OfflineGameLayout.jsx";
import { getRandomCountries } from "../../../services/AdminService.js";

function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
}

function CountryByCapital() {
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
    const [gameOver, setGameOver] = useState(false);

    const maxErrors = 3;

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setError("");

            try {
                const all = await getRandomCountries(100);
                const valid = all.filter(
                    (c) => c.nombre && c.capital && c.imagen_pais
                );

                if (valid.length < 4) {
                    throw new Error("No hay suficientes países válidos.");
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
            setGameOver(true);
            setLoading(false);
            return;
        }

        const correctCountry = poolRef.current.shift();

        const others = bankRef.current.filter(
            (c) => c.id !== correctCountry.id
        );

        const distractors = shuffle(others).slice(0, 3);

        const finalOptions = shuffle([correctCountry, ...distractors]);

        console.log("options length:", finalOptions.length);

        setRoundNumber((n) => n + 1);

        setRound({
            prompt: `¿Qué país corresponde a esta capital? ${correctCountry.capital}`,
            imageSrc: correctCountry.imagen_pais,
            imageAlt: `Bandera o referencia visual de ${correctCountry.nombre}`,
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
        if (initialized) loadRound();
    }, [initialized, loadRound]);

    function handleSelectOption(option) {
        if (!round || selectedOption) return;

        const isCorrect = option === round.correctValue;

        setSelectedOption(option);
        setCorrectOption(round.correctValue);

        if (isCorrect) {
            setCorrectCount((c) => c + 1);
            setFeedback("Correcto. Elegiste el país correspondiente a la capital mostrada.");
        } else {
            setWrongCount((w) => {
                const newWrong = w + 1;

                if (newWrong >= maxErrors) {
                    setGameOver(true);
                }

                return newWrong;
            });

            setFeedback(`Incorrecto. La respuesta correcta era ${round.correctValue}.`);
        }
    }

    function handleReplay() {
        poolRef.current = shuffle([...bankRef.current]);

        setCorrectCount(0);
        setWrongCount(0);
        setRoundNumber(0);
        setGameOver(false);

        setLoading(true);
        setInitialized(false);
        setTimeout(() => setInitialized(true), 0);
    }

    if (gameOver) {
        return (
            <div style={{ padding: "2rem", textAlign: "center" }}>
                <h2>Partida terminada</h2>
                <p>✅ Correctas: {correctCount}</p>
                <p>❌ Incorrectas: {wrongCount}</p>

                <button onClick={handleReplay} style={{ marginRight: "1rem" }}>
                    Jugar de nuevo
                </button>

                <button onClick={() => navigate("/offline")}>
                    Volver
                </button>
            </div>
        );
    }

    const prompt = loading
        ? "Cargando nueva ronda..."
        : error
            ? "No pudimos preparar esta partida"
            : round?.prompt || "Preparando desafío...";

    const options = loading ? [] : error ? [] : round?.options || [];

    return (
        <OfflineGameLayout
            title={`País por capital • ${roundNumber}/${totalRounds} • ✅ ${correctCount} ❌ ${wrongCount}/${maxErrors}`}
            prompt={prompt}
            imageSrc={!loading && !error ? round?.imageSrc : ""}
            imageAlt={round?.imageAlt}
            options={options}
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
            onBack={() => navigate("/offline")}
            actionLabel={
                poolRef.current.length === 0 && selectedOption
                    ? "Ver resultados"
                    : "Siguiente"
            }
            onAction={loadRound}
            isActionDisabled={loading || !selectedOption}
        />
    );
}

export default CountryByCapital;