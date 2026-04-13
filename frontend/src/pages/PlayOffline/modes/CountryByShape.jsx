import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import OfflineGameLayout from "../components/OfflineGameLayout.jsx";
import { getCountries } from "../../../services/AdminService.js";

function sampleCountries(countries, size = 4) {
    return [...countries].sort(() => Math.random() - 0.5).slice(0, size);
}

function CountryByShape() {
    const navigate = useNavigate();
    const [round, setRound] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [correctOption, setCorrectOption] = useState(null);
    const [feedback, setFeedback] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadRound = useCallback(async () => {
        setLoading(true);
        setError("");
        setSelectedOption(null);
        setCorrectOption(null);
        setFeedback("");

        try {
            const countries = await getCountries();
            const validCountries = countries.filter(
                (country) => country.nombre && country.imagen_silueta
            );
            const options = sampleCountries(validCountries, 4);

            if (options.length < 4) {
                throw new Error(
                    "No hay suficientes países con silueta disponible para este modo."
                );
            }

            const correctCountry = options[Math.floor(Math.random() * options.length)];

            setRound({
                prompt: "¿Qué país corresponde a esta silueta?",
                imageSrc: correctCountry.imagen_silueta,
                imageAlt: `Silueta de ${correctCountry.nombre}`,
                options: options.map((country) => ({
                    id: country.id,
                    value: country.nombre,
                    label: country.nombre,
                })),
                correctValue: correctCountry.nombre,
            });
        } catch (err) {
            setError(err.message || "No se pudo cargar la ronda.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadRound();
    }, [loadRound]);

    function handleSelectOption(option) {
        if (!round || selectedOption) {
            return;
        }

        const isCorrect = option === round.correctValue;
        setSelectedOption(option);
        setCorrectOption(round.correctValue);
        setFeedback(
            isCorrect
                ? "Correcto. Reconociste la silueta correctamente."
                : `Incorrecto. La respuesta correcta era ${round.correctValue}.`
        );
    }

    const prompt = loading
        ? "Cargando nueva ronda..."
        : error
            ? "No pudimos preparar esta partida"
            : round?.prompt || "Preparando desafío...";

    const options = loading || error ? [] : round?.options || [];

    return (
        <OfflineGameLayout
            title="País por silueta"
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
            actionLabel={error ? "Reintentar" : "Siguiente"}
            onAction={loadRound}
            isActionDisabled={loading}
            imageFit="contain"
        />
    );
}

export default CountryByShape;