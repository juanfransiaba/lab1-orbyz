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

function loadCountryImages() {
    const filePath = path.join(__dirname, 'countryImages.js');
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
        throw new Error('countryImages.js no contiene un array JSON valido.');
    }

    return data;
}

async function seedImagenesPaises() {
    try {
        console.log('🖼️  Actualizando imagen_pais desde countryImages.js...');

        const countryImages = loadCountryImages();
        let actualizados = 0;
        let sinCoincidencia = 0;
        let sinImagen = 0;

        for (const pais of countryImages) {
            const nombre = pais?.nombre?.trim();
            const imagenPais = pais?.imagen_pais?.trim() || '';

            if (!nombre) {
                continue;
            }

            if (!imagenPais) {
                sinImagen++;
                continue;
            }

            const result = await pool.query(
                `UPDATE paises
                 SET imagen_pais = $1
                 WHERE nombre = $2`,
                [imagenPais, nombre]
            );

            if (result.rowCount > 0) {
                actualizados += result.rowCount;
            } else {
                sinCoincidencia++;
                console.warn(`⚠️  No se encontro el pais en la base: ${nombre}`);
            }
        }

        console.log(`✅ ${actualizados} paises actualizados correctamente`);
        console.log(`ℹ️  ${sinImagen} paises sin imagen_pais en el archivo`);
        console.log(`ℹ️  ${sinCoincidencia} paises del archivo no coincidieron con la base`);
    } catch (error) {
        console.error('❌ Error al actualizar imagen_pais:', error);
    } finally {
        await pool.end();
    }
}

seedImagenesPaises();
