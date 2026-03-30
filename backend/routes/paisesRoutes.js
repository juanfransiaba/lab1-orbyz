const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/buscar/:nombre', async (req, res) => {
    try {
        const { nombre } = req.params;
        const { rows } = await pool.query(
            `SELECT * FROM paises WHERE LOWER(nombre) LIKE LOWER($1)`,
            [`%${nombre}%`]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'País no encontrado' });
        }

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar el país' });
    }
});

module.exports = router;