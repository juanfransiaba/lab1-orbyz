const { Pool } = require('pg');
const { execSync } = require('child_process');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const PAISES_EXCLUIDOS = new Set([
    'American Samoa',
    'Aruba',
    'British Indian Ocean Territory',
    'British Virgin Islands',
    'Caribbean Netherlands',
    'Cayman Islands',
    'Christmas Island',
    'Cocos (Keeling) Islands',
    'Cook Islands',
    'Curaçao',
    'Falkland Islands',
    'Faroe Islands',
    'French Guiana',
    'French Polynesia',
    'French Southern and Antarctic Lands',
    'Guadeloupe',
    'Kosovo',
    'Gibraltar',
    'Guam',
    'Guernsey',
    'Hong Kong',
    'Isle of Man',
    'Jersey',
    'Martinique',
    'Mayotte',
    'Montserrat',
    'New Caledonia',
    'Niue',
    'Norfolk Island',
    'Northern Mariana Islands',
    'Palestine',
    'Pitcairn Islands',
    'Réunion',
    'Saint Barthélemy',
    'Saint Helena, Ascension and Tristan da Cunha',
    'Saint Martin',
    'Saint Pierre and Miquelon',
    'Sint Maarten',
    'South Georgia',
    'Svalbard and Jan Mayen',
    'Tokelau',
    'Turks and Caicos Islands',
    'United States Minor Outlying Islands',
    'United States Virgin Islands',
    'Wallis and Futuna',
    'Western Sahara',
    'Åland Islands',
]);

async function seedPaises() {
    try {
        console.log('📡 Obteniendo países de la API...');

        const res = await fetch(
            'https://raw.githubusercontent.com/mledoze/countries/master/countries.json'
        );
        const data = await res.json();

        if (!res.ok || !Array.isArray(data)) {
            console.error('Respuesta inesperada:', data);
            throw new Error(`No se pudo bajar el dataset (status ${res.status})`);
        }

        const paises = data;

        const paisesValidos = paises.filter(
            (p) =>
                p.capital?.length &&
                p.name?.common &&
                p.region &&
                p.cca2 &&
                p.ccn3 &&
                !PAISES_EXCLUIDOS.has(p.name.common)
        );

        console.log(`✅ ${paisesValidos.length} países válidos después del filtro`);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS paises (
                id_pais SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                capital VARCHAR(100),
                continente VARCHAR(100),
                imagen_pais TEXT,
                imagen_silueta TEXT,
                iso_code VARCHAR(3)
            )
        `);

        await pool.query(`TRUNCATE TABLE paises RESTART IDENTITY CASCADE`);
        console.log('🗑️  Tabla limpiada');

        for (const pais of paisesValidos) {
            const flag = `https://flagcdn.com/w320/${pais.cca2.toLowerCase()}.png`;
            await pool.query(
                `INSERT INTO paises (nombre, capital, continente, imagen_pais, imagen_silueta, iso_code)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [pais.name.common, pais.capital[0], pais.region, flag, null, pais.ccn3]
            );
        }

        console.log(`🌍 ${paisesValidos.length} países insertados correctamente`);

        // Llama al seed de siluetas una vez insertados todos los países
        execSync('node seed/seedSiluetas.js', { stdio: 'inherit' });
        console.log('\n➡️  Ejecutando seed de imágenes...');
        execSync('node seed/countryImages.js', { stdio: 'inherit' });

    } catch (error) {
        console.error('❌ Error durante el seed:', error);
    } finally {
        await pool.end();
    }
}

seedPaises();