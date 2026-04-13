const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const WIKIPEDIA_NOMBRES = {
    'Bolivia': 'Bolivia',
    'Brunei': 'Brunei',
    'Cape Verde': 'Cape_Verde',
    'Comoros': 'Comoros',
    'DR Congo': 'Democratic_Republic_of_the_Congo',
    'Dominican Republic': 'Dominican_Republic',
    'Eswatini': 'Eswatini',
    'Ivory Coast': "Ivory_Coast",
    'Laos': 'Laos',
    'Marshall Islands': 'Marshall_Islands',
    'Micronesia': 'Federated_States_of_Micronesia',
    'Myanmar': 'Myanmar',
    'New Zealand': 'New_Zealand',
    'North Korea': 'North_Korea',
    'North Macedonia': 'North_Macedonia',
    'Papua New Guinea': 'Papua_New_Guinea',
    'Republic of the Congo': 'Republic_of_the_Congo',
    'Russia': 'Russia',
    'Saint Kitts and Nevis': 'Saint_Kitts_and_Nevis',
    'Saint Lucia': 'Saint_Lucia',
    'Saint Vincent and the Grenadines': 'Saint_Vincent_and_the_Grenadines',
    'San Marino': 'San_Marino',
    'Saudi Arabia': 'Saudi_Arabia',
    'Sierra Leone': 'Sierra_Leone',
    'Solomon Islands': 'Solomon_Islands',
    'South Africa': 'South_Africa',
    'South Korea': 'South_Korea',
    'South Sudan': 'South_Sudan',
    'Sri Lanka': 'Sri_Lanka',
    'São Tomé and Príncipe': 'São_Tomé_and_Príncipe',
    'Timor-Leste': 'East_Timor',
    'Trinidad and Tobago': 'Trinidad_and_Tobago',
    'United Arab Emirates': 'United_Arab_Emirates',
    'United Kingdom': 'United_Kingdom',
    'United States': 'United_States',
    'Vatican City': 'Vatican_City',
};

async function fetchImagenWikipedia(nombre) {
    const wikiNombre = WIKIPEDIA_NOMBRES[nombre] || nombre.replace(/ /g, '_');
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiNombre)}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.thumbnail?.source || null;
    } catch (error) {
        return null;
    }
}

async function seedImagenesPaises() {
    try {
        const { rows: paises } = await pool.query(
            `SELECT id_pais, nombre FROM paises ORDER BY nombre ASC`
        );

        let actualizados = 0;

        for (const pais of paises) {
            const imagen = await fetchImagenWikipedia(pais.nombre);
            if (imagen) {
                await pool.query(
                    `UPDATE paises SET imagen_pais = $1 WHERE id_pais = $2`,
                    [imagen, pais.id_pais]
                );
                actualizados++;
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
        }

        console.log(`✅ ${actualizados}/${paises.length} imágenes actualizadas correctamente`);

    } catch (error) {
        console.error('❌ Error general:', error);
    } finally {
        await pool.end();
    }
}

seedImagenesPaises();