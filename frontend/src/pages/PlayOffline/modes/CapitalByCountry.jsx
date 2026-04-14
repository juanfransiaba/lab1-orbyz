import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import OfflineGameLayout from "../components/OfflineGameLayout.jsx";
import { getRandomCountries } from "../../../services/AdminService.js";

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function pickOptions(correct, bank) {
    console.log("bank size:", bank.length);

    const others = bank.filter((c) => c.id !== correct.id);
    console.log("others size:", others.length);

    const shuffled = shuffle(others);
    const distractors = shuffled.slice(0, 3);

    console.log("distractors:", distractors.length);

    const options = shuffle([correct, ...distractors]);

    console.log(
        "FINAL OPTIONS:",
        options.map((o) => ({
            id: o.id,
            capital: o.capital,
        }))
    );

    return options;
}

function CapitalByCountry() {
    const navigate = useNavigate();

    const poolRef = useRef([]);   // países correctos pendientes (se va vaciando)
    const bankRef = useRef([]);   // todos los países, solo para distractores

    const [initialized, setInitialized] = useState(false);
    const [round, setRound] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [correctOption, setCorrectOption] = useState(null);
    const [feedback, setFeedback] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [score, setScore] = useState(0);
    const [roundNumber, setRoundNumber] = useState(0);
    const [totalRounds, setTotalRounds] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [correctCount, setCorrectCount] = useState(0);
    const [wrongCount, setWrongCount] = useState(0);
    const maxErrors = 3;

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setError("");
            try {
                const all = await getRandomCountries(300);
                const valid = all.filter(
                    (c) => c.nombre && c.capital && c.imagen_pais
                );
                if (valid.length < 4) {
                    throw new Error("No hay suficientes países válidos.");
                }
                bankRef.current = valid;
                poolRef.current = shuffle([...valid]);

                console.log("banco cargado:", bankRef.current.length);
                console.log("ejemplo país:", bankRef.current[0]); // 👈 AGREGÁ ESTE

                setTotalRounds(valid.length);
                console.log("banco cargado:", bankRef.current.length); // ← agregá esto
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
            setGameOver(true);
            setLoading(false);
            return;
        }

        const correct = poolRef.current.shift();
        const options = pickOptions(correct, bankRef.current);

        console.log("options length:", options.length);
        console.log("options:", options.map(c => ({ id: c.id_pais, capital: c.capital })));

        setRoundNumber((n) => n + 1);
        setRound({
            prompt: `${correct.nombre}?`,
            imageSrc: correct.imagen_pais,
            imageAlt: `Bandera de ${correct.nombre}`,
            options: options.map((c) => ({
                id: c.id_pais,
                value: c.capital,
                label: c.capital,
            })),
            correctValue: correct.capital,
        });
        setLoading(false);
    }, []);

    useEffect(() => {
        if (initialized) nextRound();
    }, [initialized, nextRound]);

    function handleSelectOption(option) {
        if (!round || selectedOption) return;

        const isCorrect = option === round.correctValue;

        setSelectedOption(option);
        setCorrectOption(round.correctValue);

        if (isCorrect) {
            setScore((s) => s + 1);
            setCorrectCount((c) => c + 1);
            setFeedback("Correcto.");
        } else {
            setWrongCount((w) => {
                const newWrong = w + 1;

                if (newWrong >= maxErrors) {
                    setGameOver(true);
                }

                return newWrong;
            });

            setFeedback(`Incorrecto. La respuesta era ${round.correctValue}.`);
        }
    }

    function handleReplay() {
        poolRef.current = shuffle([...bankRef.current]);
        setScore(0);
        setRoundNumber(0);
        setGameOver(false);

        setCorrectCount(0);
        setWrongCount(0);

        setLoading(true);
        setInitialized(false);
        setTimeout(() => setInitialized(true), 0);
    }

    if (gameOver) {
        return (
            <div style={{ padding: "2rem", textAlign: "center" }}>
                <h2>Partida terminada</h2>
                <p style={{ fontSize: "1.25rem", margin: "1rem 0" }}>
                    Respondiste {score} de {totalRounds} correctamente.
                </p>
                <button onClick={handleReplay} style={{ marginRight: "1rem" }}>
                    Jugar de nuevo
                </button>
                <button onClick={() => navigate("/offline")}>Volver</button>
            </div>
        );
    }

    const prompt = loading
        ? "Cargando..."
        : error
            ? "No pudimos preparar esta partida"
            : round?.prompt ?? "Preparando...";

    return (
        <OfflineGameLayout
            title={`Capital por país • ${roundNumber}/${totalRounds} • ✅ ${correctCount} ❌ ${wrongCount}/${maxErrors}`}            prompt={prompt}
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
            onBack={() => navigate("/offline")}
            actionLabel={
                poolRef.current.length === 0 && selectedOption
                    ? "Ver resultados"
                    : "Siguiente"
            }
            onAction={nextRound}
            isActionDisabled={loading || !selectedOption}
        />
    );
}

export default CapitalByCountry;