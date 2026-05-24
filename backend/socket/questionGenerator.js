const pool = require("../db");

function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

async function fetchCountries(mode, continent) {
    let query =
        "SELECT id_pais, nombre, capital, continente, imagen_pais, imagen_silueta FROM paises";
    const values = [];

    if (mode === "country-by-continent") {
        query += " WHERE LOWER(continente) = LOWER($1)";
        values.push(continent);
    }

    const { rows } = await pool.query(query, values);
    return rows;
}

// Filtra los países que tienen los datos necesarios para el modo
function filterValidCountries(countries, mode) {
    return countries.filter((c) => {
        if (mode === "country-by-shape") {
            return c.nombre && c.imagen_silueta;
        }
        return c.nombre && c.capital;
    });
}

function buildQuestion(correctCountry, allValid, mode, index) {
    const others = allValid.filter((c) => c.id_pais !== correctCountry.id_pais);
    const distractors = shuffle(others).slice(0, 3);
    const optionCountries = shuffle([correctCountry, ...distractors]);

    let prompt;
    let imageSrc = "";
    let imageAlt = "";
    let options;
    let correctValue;

    if (mode === "capital-by-country") {
        // muestra el país, elegís la capital
        prompt = correctCountry.nombre;
        imageSrc = correctCountry.imagen_pais || "";
        imageAlt = `Referencia de ${correctCountry.nombre}`;
        options = optionCountries.map((c) => c.capital);
        correctValue = correctCountry.capital;
    } else if (mode === "country-by-shape") {
        // muestra la silueta, elegís el país
        prompt = "¿Qué país corresponde a esta silueta?";
        imageSrc = correctCountry.imagen_silueta || "";
        imageAlt = `Silueta de ${correctCountry.nombre}`;
        options = optionCountries.map((c) => c.nombre);
        correctValue = correctCountry.nombre;
    } else {
        // country-by-capital y country-by-continent: muestra la capital, elegís el país
        prompt = correctCountry.capital;
        imageSrc = correctCountry.imagen_pais || "";
        imageAlt = `Referencia de ${correctCountry.nombre}`;
        options = optionCountries.map((c) => c.nombre);
        correctValue = correctCountry.nombre;
    }

    return { index, prompt, imageSrc, imageAlt, options, correctValue };
}

async function generateQuestions(mode, continent) {
    const countries = await fetchCountries(mode, continent);
    const valid = filterValidCountries(countries, mode);

    if (valid.length < 4) {
        throw new Error("No hay suficientes países para este modo");
    }

    const sequence = shuffle(valid);
    return sequence.map((country, index) =>
        buildQuestion(country, valid, mode, index)
    );
}

module.exports = { generateQuestions };