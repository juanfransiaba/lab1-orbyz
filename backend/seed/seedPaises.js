require('dotenv').config();
const fetch = require('node-fetch');
const pool = require('../db');

async function seedPaises() {
    const res = await fetch(
        "https://restcountries.com/v3.1/all?fields=name,cca2,capital,flags,region"
    );
    const paises = await res.json();

    const paisesValidos = paises.filter(
        (p) => p.capital?.length && p.flags?.png && p.name?.common && p.region
    );

    await pool.query(`
        CREATE TABLE IF NOT EXISTS paises (
                                              id_pais SERIAL PRIMARY KEY,
                                              nombre VARCHAR(100) NOT NULL,
            capital VARCHAR(100),
            continente VARCHAR(100),
            imagen_pais TEXT,
            imagen_silueta TEXT
            )
    `);

    for (const pais of paisesValidos) {
        await pool.query(
            `INSERT INTO paises (nombre, capital, continente, imagen_pais, imagen_silueta)
             VALUES ($1, $2, $3, $4, $5)`,
            [pais.name.common, pais.capital[0], pais.region, pais.flags.png, null]
        );
    }

    console.log(`✅ ${paisesValidos.length} países insertados`);
    await pool.end();
}

seedPaises().catch(console.error);