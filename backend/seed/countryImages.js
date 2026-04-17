const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});


const IMAGES_DIR = path.resolve(__dirname, '../../frontend/public/images/paises');
const IMAGE_PATH_PREFIX = '/images/paises';

const FILE_ALIASES = {
    alemania: 'Germany',
    antiguaybarbuda: 'Antigua and Barbuda',
    arabiasaudita: 'Saudi Arabia',
    azerbaiyan: 'Azerbaijan',
    bosnia: 'Bosnia and Herzegovina',
    brasil: 'Brazil',
    caboverde: 'Cape Verde',
    camboya: 'Cambodia',
    camerun: 'Cameroon',
    comoras: 'Comoros',
    coreadelnorte: 'North Korea',
    coreadelsur: 'South Korea',
    costademarfil: 'Ivory Coast',
    costarica: 'Costa Rica',
    croacia: 'Croatia',
    dinamarca: 'Denmark',
    egipto: 'Egypt',
    elsalvador: 'El Salvador',
    emiratosarabesunidos: 'United Arab Emirates',
    eslovaquia: 'Slovakia',
    eslovenia: 'Slovenia',
    espana: 'Spain',
    estadosunidos: 'United States',
    etiopia: 'Ethiopia',
    filipinas: 'Philippines',
    finlandia: 'Finland',
    granada: 'Grenada',
    groenlandia: 'Greenland',
    guineabissau: 'Guinea-Bissau',
    guineaecuatorial: 'Equatorial Guinea',
    islasmarshall: 'Marshall Islands',
    kazajistan: 'Kazakhstan',
    lesoto: 'Lesotho',
    libano: 'Lebanon',
    macedoniadelnorte: 'North Macedonia',
    maldivas: 'Maldives',
    noruega: 'Norway',
    paisesbajos: 'Netherlands',
    papuanuevaguinea: 'Papua New Guinea',
    polonia: 'Poland',
    puertorico: 'Puerto Rico',
    rdcongo: 'DR Congo',
    reinounido: 'United Kingdom',
    republicacentroafricana: 'Central African Republic',
    republicadominicana: 'Dominican Republic',
    rumania: 'Romania',
    rusia: 'Russia',
    sancristobalynieves: 'Saint Kitts and Nevis',
    sanmarino: 'San Marino',
    santalucia: 'Saint Lucia',
    sanvicenteylasgranadinas: 'Saint Vincent and the Grenadines',
    singapur: 'Singapore',
    siria: 'Syria',
    srilanka: 'Sri Lanka',
    sudafrica: 'South Africa',
    suecia: 'Sweden',
    suiza: 'Switzerland',
    surinam: 'Suriname',
    tailandia: 'Thailand',
    timororiental: 'Timor-Leste',
    trinidadytobago: 'Trinidad and Tobago',
    turquia: 'Turkey',
    ucrania: 'Ukraine',
    vaticano: 'Vatican City',
};

function normalize(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '')
        .toLowerCase();
}

function resolveCountryName(fileName, countryMap) {
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const normalizedBaseName = normalize(baseName);
    const alias = FILE_ALIASES[normalizedBaseName] || baseName;
    return countryMap.get(normalize(alias)) || null;
}

async function main() {
    try {
        const { rows } = await pool.query('SELECT nombre FROM paises ORDER BY nombre ASC');
        const countryMap = new Map(rows.map((row) => [normalize(row.nombre), row.nombre]));

        const files = fs
            .readdirSync(IMAGES_DIR)
            .filter((file) => /\.(jpe?g|png|webp)$/i.test(file));

        let updated = 0;
        const unmatched = [];

        for (const file of files) {
            const countryName = resolveCountryName(file, countryMap);

            if (!countryName) {
                unmatched.push(file);
                continue;
            }

            await pool.query(
                `UPDATE paises
                 SET imagen_pais = $1
                 WHERE nombre = $2`,
                [`${IMAGE_PATH_PREFIX}/${file}`, countryName]
            );

            updated++;
        }

        console.log(`Actualizados: ${updated}`);
        console.log(`Sin match: ${unmatched.length}`);

        if (unmatched.length > 0) {
            console.log('Archivos sin match en DB:');
            unmatched.forEach((file) => console.log(`- ${file}`));
        }
    } catch (error) {
        console.error('Error al actualizar imagen_pais desde frontend/public/images/paises:', error);
    } finally {
        await pool.end();
    }
}

main();

