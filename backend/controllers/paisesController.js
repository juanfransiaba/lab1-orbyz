const pool = require('../db');

const obtenerTodosLosPaises = async (req, res) => {
    try {
        const { rows } = await pool.query(`SELECT * FROM paises ORDER BY nombre ASC`);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener los países' });
    }
};

const obtenerPaisPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(
            `SELECT * FROM paises WHERE id_pais = $1`, [id]  // ← id_pais
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'País no encontrado' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener el país' });
    }
};

const buscar = async (req, res) => {
    try {
        const { nombre, continente } = req.query;

        if (!nombre && !continente) {
            return res.status(400).json({ error: 'Debe enviar al menos un filtro: nombre o continente' });
        }

        let query = `SELECT * FROM paises WHERE 1=1`;
        const values = [];
        let i = 1;

        if (nombre) {
            query += ` AND LOWER(nombre) LIKE LOWER($${i++})`;
            values.push(`%${nombre}%`);
        }

        if (continente) {
            query += ` AND LOWER(continente) LIKE LOWER($${i++})`;
            values.push(`%${continente}%`);
        }

        query += ` ORDER BY nombre ASC`;

        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron países' });
        }

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar' });
    }
};

const crearPais = async (req, res) => {
    try {
        const { nombre, capital, continente, imagen_pais, imagen_silueta } = req.body;  // ← columnas reales

        if (!nombre) {
            return res.status(400).json({ error: 'El nombre del país es obligatorio' });
        }

        const { rows } = await pool.query(
            `INSERT INTO paises (nombre, capital, continente, imagen_pais, imagen_silueta)
             VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
            [nombre, capital, continente, imagen_pais, imagen_silueta]
        );

        res.status(201).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear el país' });
    }
};

const actualizarPais = async (req, res) => {
    try {
        const { id } = req.params;
        const campos = req.body;

        if (Object.keys(campos).length === 0) {
            return res.status(400).json({ error: 'No se enviaron campos para actualizar' });
        }

        const keys = Object.keys(campos);
        const values = Object.values(campos);
        const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

        const { rows } = await pool.query(
            `UPDATE paises SET ${setClause} WHERE id_pais = $${keys.length + 1} RETURNING *`,  // ← id_pais
            [...values, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'País no encontrado' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar el país' });
    }
};

const eliminarPaisPorId = async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(
            `DELETE FROM paises WHERE id_pais = $1 RETURNING *`,  // ← id_pais
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'País no encontrado' });
        }

        res.json({ mensaje: 'País eliminado correctamente', pais: rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar el país' });
    }
};

const eliminarPaisPorCampo = async (req, res) => {
    try {
        const { nombre, capital, continente } = req.query;

        if (!nombre && !capital && !continente) {
            return res.status(400).json({ error: 'Debe enviar al menos un filtro: nombre, capital o continente' });
        }

        let query = `DELETE FROM paises WHERE 1=1`;
        const values = [];
        let i = 1;

        if (nombre) {
            query += ` AND LOWER(nombre) = LOWER($${i++})`;
            values.push(nombre);
        }

        if (capital) {
            query += ` AND LOWER(capital) = LOWER($${i++})`;
            values.push(capital);
        }

        if (continente) {
            query += ` AND LOWER(continente) = LOWER($${i++})`;
            values.push(continente);
        }

        query += ` RETURNING *`;

        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No se encontraron países con esos filtros' });
        }

        res.json({ mensaje: `Se eliminaron ${rows.length} país/es`, paises: rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar' });
    }
};

module.exports = {
    obtenerTodosLosPaises,
    obtenerPaisPorId,
    buscar,
    crearPais,
    actualizarPais,
    eliminarPaisPorId,
    eliminarPaisPorCampo
};