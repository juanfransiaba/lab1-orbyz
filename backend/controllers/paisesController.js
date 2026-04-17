const pool = require("../db");
const {
    resolveCountryImagePath,
    removeManagedCountryImage,
    resolveCountrySilhouettePath,
    removeManagedCountrySilhouette,
} = require("../utils/countryImageStorage");

const ALLOWED_UPDATE_FIELDS = new Set([
    "nombre",
    "capital",
    "continente",
    "imagen_pais",
    "imagen_silueta",
]);

function sanitizeCountryPayload(payload = {}) {
    return Object.fromEntries(
        Object.entries(payload).filter(([key]) => ALLOWED_UPDATE_FIELDS.has(key))
    );
}

const obtenerTodosLosPaises = async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM paises ORDER BY nombre ASC");
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener los paises" });
    }
};

const obtenerPaisPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query("SELECT * FROM paises WHERE id_pais = $1", [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Pais no encontrado" });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener el pais" });
    }
};

const buscar = async (req, res) => {
    try {
        const { nombre, continente } = req.query;

        if (!nombre && !continente) {
            return res.status(400).json({
                error: "Debe enviar al menos un filtro: nombre o continente",
            });
        }

        let query = "SELECT * FROM paises WHERE 1=1";
        const values = [];
        let index = 1;

        if (nombre) {
            query += ` AND LOWER(nombre) LIKE LOWER($${index++})`;
            values.push(`%${nombre}%`);
        }

        if (continente) {
            query += ` AND LOWER(continente) LIKE LOWER($${index++})`;
            values.push(`%${continente}%`);
        }

        query += " ORDER BY nombre ASC";

        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ error: "No se encontraron paises" });
        }

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al buscar" });
    }
};

const crearPais = async (req, res) => {
    try {
        const {
            nombre = "",
            capital = "",
            continente = "",
            imagen_pais = "",
            imagen_silueta = "",
        } = req.body;

        if (!nombre.trim()) {
            return res.status(400).json({ error: "El nombre del pais es obligatorio" });
        }

        const resolvedImagePath = await resolveCountryImagePath({
            imageValue: imagen_pais,
            countryName: nombre,
        });
        const resolvedSilhouettePath = await resolveCountrySilhouettePath({
            imageValue: imagen_silueta,
            countryName: nombre,
        });

        const { rows } = await pool.query(
            "INSERT INTO paises (nombre, capital, continente, imagen_pais, imagen_silueta) " +
                "VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [
                nombre.trim(),
                capital.trim(),
                continente.trim(),
                resolvedImagePath,
                resolvedSilhouettePath,
            ]
        );

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({
            error: error.message || "Error al crear el pais",
        });
    }
};

const actualizarPais = async (req, res) => {
    try {
        const { id } = req.params;
        const campos = sanitizeCountryPayload(req.body);

        if (Object.keys(campos).length === 0) {
            return res.status(400).json({
                error: "No se enviaron campos para actualizar",
            });
        }

        const existingCountryResult = await pool.query(
            "SELECT * FROM paises WHERE id_pais = $1",
            [id]
        );

        if (existingCountryResult.rows.length === 0) {
            return res.status(404).json({ error: "Pais no encontrado" });
        }

        const existingCountry = existingCountryResult.rows[0];

        if (Object.prototype.hasOwnProperty.call(campos, "nombre")) {
            campos.nombre = String(campos.nombre || "").trim();
        }

        if (Object.prototype.hasOwnProperty.call(campos, "capital")) {
            campos.capital = String(campos.capital || "").trim();
        }

        if (Object.prototype.hasOwnProperty.call(campos, "continente")) {
            campos.continente = String(campos.continente || "").trim();
        }

        let previousManagedImagePath = "";
        let previousManagedSilhouettePath = "";

        if (Object.prototype.hasOwnProperty.call(campos, "imagen_pais")) {
            campos.imagen_pais = await resolveCountryImagePath({
                imageValue: campos.imagen_pais,
                countryName: campos.nombre || existingCountry.nombre,
            });

            if (
                existingCountry.imagen_pais &&
                existingCountry.imagen_pais !== campos.imagen_pais
            ) {
                previousManagedImagePath = existingCountry.imagen_pais;
            }
        }

        if (Object.prototype.hasOwnProperty.call(campos, "imagen_silueta")) {
            campos.imagen_silueta = await resolveCountrySilhouettePath({
                imageValue: campos.imagen_silueta,
                countryName: campos.nombre || existingCountry.nombre,
            });

            if (
                existingCountry.imagen_silueta &&
                existingCountry.imagen_silueta !== campos.imagen_silueta
            ) {
                previousManagedSilhouettePath = existingCountry.imagen_silueta;
            }
        }

        const keys = Object.keys(campos);
        const values = keys.map((key) => campos[key]);
        const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(", ");

        const { rows } = await pool.query(
            `UPDATE paises SET ${setClause} WHERE id_pais = $${keys.length + 1} RETURNING *`,
            [...values, id]
        );

        if (previousManagedImagePath) {
            await removeManagedCountryImage(previousManagedImagePath);
        }

        if (previousManagedSilhouettePath) {
            await removeManagedCountrySilhouette(previousManagedSilhouettePath);
        }

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({
            error: error.message || "Error al actualizar el pais",
        });
    }
};

const eliminarPaisPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(
            "DELETE FROM paises WHERE id_pais = $1 RETURNING *",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Pais no encontrado" });
        }

        if (rows[0].imagen_pais) {
            await removeManagedCountryImage(rows[0].imagen_pais);
        }

        if (rows[0].imagen_silueta) {
            await removeManagedCountrySilhouette(rows[0].imagen_silueta);
        }

        res.json({ mensaje: "Pais eliminado correctamente", pais: rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al eliminar el pais" });
    }
};

const eliminarPaisPorCampo = async (req, res) => {
    try {
        const { nombre, capital, continente } = req.query;

        if (!nombre && !capital && !continente) {
            return res.status(400).json({
                error: "Debe enviar al menos un filtro: nombre, capital o continente",
            });
        }

        let query = "DELETE FROM paises WHERE 1=1";
        const values = [];
        let index = 1;

        if (nombre) {
            query += ` AND LOWER(nombre) = LOWER($${index++})`;
            values.push(nombre);
        }

        if (capital) {
            query += ` AND LOWER(capital) = LOWER($${index++})`;
            values.push(capital);
        }

        if (continente) {
            query += ` AND LOWER(continente) = LOWER($${index++})`;
            values.push(continente);
        }

        query += " RETURNING *";

        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({
                error: "No se encontraron paises con esos filtros",
            });
        }

        await Promise.all(
            rows.flatMap((country) => [
                removeManagedCountryImage(country.imagen_pais),
                removeManagedCountrySilhouette(country.imagen_silueta),
            ])
        );

        res.json({ mensaje: `Se eliminaron ${rows.length} pais/es`, paises: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al eliminar" });
    }
};

const obtenerPaisesRandom = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 4;

        const { rows } = await pool.query(
            "SELECT * FROM paises ORDER BY RANDOM() LIMIT $1",
            [limit]
        );

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener paises aleatorios" });
    }
};

const obtenerPaisesPorContinente = async (req, res) => {
    try {
        const { continente } = req.params;

        const { rows } = await pool.query(
            "SELECT * FROM paises WHERE LOWER(continente) = LOWER($1) ORDER BY nombre ASC",
            [continente]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: "No se encontraron paises para ese continente",
            });
        }

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error al obtener paises por continente" });
    }
};

const obtenerPaisesPorContinenteRandom = async (req, res) => {
    try {
        const { continente } = req.params;
        const limit = parseInt(req.query.limit, 10) || 4;

        const { rows } = await pool.query(
            "SELECT * FROM paises WHERE LOWER(continente) = LOWER($1) ORDER BY RANDOM() LIMIT $2",
            [continente, limit]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: "No se encontraron paises para ese continente",
            });
        }

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Error al obtener paises aleatorios por continente",
        });
    }
};

module.exports = {
    obtenerTodosLosPaises,
    obtenerPaisPorId,
    buscar,
    crearPais,
    actualizarPais,
    eliminarPaisPorId,
    eliminarPaisPorCampo,
    obtenerPaisesRandom,
    obtenerPaisesPorContinente,
    obtenerPaisesPorContinenteRandom,
};
