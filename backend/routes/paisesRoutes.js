const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/adminMiddleware');

const {
    // ── existentes ──
    obtenerTodosLosPaises,
    obtenerPaisPorId,
    buscar,
    crearPais,
    actualizarPais,
    eliminarPaisPorId,
    eliminarPaisPorCampo,

    // ── nuevas para minijuegos ──
    obtenerPaisesRandom,
    obtenerPaisesPorContinente,
    obtenerPaisesPorContinenteRandom,
} = require('../controllers/paisesController');

// ─────────────────────────────────────────────
// RUTAS PÚBLICAS — cualquier usuario logueado puede usarlas
// ─────────────────────────────────────────────

router.get('/', obtenerTodosLosPaises);
router.get('/buscar', buscar);

// IMPORTANTE: estas rutas con path fijo van ANTES de /:id
// si las ponés después, Express interpreta "random" como un id

router.get('/random', obtenerPaisesRandom);
// GET /api/paises/random?limit=4
// Devuelve 4 países al azar — usado en CountryByCapital, CapitalByCountry, CountryByShape

router.get('/continente/:continente', obtenerPaisesPorContinente);
// GET /api/paises/continente/Europa
// Devuelve todos los países de ese continente — usado en CountryByContinent

router.get('/continente/:continente/random', obtenerPaisesPorContinenteRandom);
// GET /api/paises/continente/Europa/random?limit=4
// Devuelve N países al azar de ese continente — usado para armar opciones en CountryByContinent

router.get('/:id', obtenerPaisPorId);
// Va al final para que no capture las rutas de arriba

// ─────────────────────────────────────────────
// RUTAS SOLO ADMIN
// ─────────────────────────────────────────────

router.post('/', verifyToken, isAdmin, crearPais);
router.put('/:id', verifyToken, isAdmin, actualizarPais);
router.patch('/:id', verifyToken, isAdmin, actualizarPais);
router.delete('/eliminar', verifyToken, isAdmin, eliminarPaisPorCampo);
router.delete('/:id', verifyToken, isAdmin, eliminarPaisPorId);

module.exports = router;