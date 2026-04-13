import { useCallback, useEffect, useMemo, useState } from "react";
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

function sampleCountries(countries, size = 4) {
    return [...countries].sort(() => Math.random() - 0.5).slice(0, size);
}

function CountryByContinent() {
    const navigate = useNavigate();
    const { continent } = useParams();
    const [round, setRound] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [correctOption, setCorrectOption] = useState(null);
    const [feedback, setFeedback] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const continentName = useMemo(
        () => CONTINENT_MAP[continent?.toLowerCase?.() || ""],
        [continent]
    );

    const loadRound = useCallback(async () => {
        if (!continentName) {
            return;
        }

        setLoading(true);
        setError("");
        setSelectedOption(null);
        setCorrectOption(null);
        setFeedback("");

        try {
            const countries = await getRandomCountriesByContinent(continentName, 8);
            const validCountries = countries.filter(
                (country) => country.nombre && country.imagen_pais
            );
            const options = sampleCountries(validCountries, 4);

            if (options.length < 4) {
                throw new Error(
                    "No hay suficientes países disponibles para este continente."
                );
            }

            const correctCountry = options[Math.floor(Math.random() * options.length)];

            setRound({
                prompt: `¿Qué país pertenece a este continente? ${continentName}`,
                imageSrc: correctCountry.imagen_pais,
                imageAlt: `Referencia visual de ${correctCountry.nombre}`,
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
    }, [continentName]);

    useEffect(() => {
        void loadRound();
    }, [loadRound]);

    if (!continentName) {
        return <Navigate to="/offline/continent-selection" replace />;
    }

    function handleSelectOption(option) {
        if (!round || selectedOption) {
            return;
        }

        const isCorrect = option === round.correctValue;
        setSelectedOption(option);
        setCorrectOption(round.correctValue);
        setFeedback(
            isCorrect
                ? `Correcto. ${option} pertenece a ${continentName}.`
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
            title="País por continente"
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
            onBack={() => navigate("/offline/continent-selection")}
            actionLabel={error ? "Reintentar" : "Siguiente"}
            onAction={loadRound}
            isActionDisabled={loading}
        />
    );
}

export default CountryByContinent;