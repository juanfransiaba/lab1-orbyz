const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/adminMiddleware');  // ← agregado

const {
    obtenerTodosLosPaises,
    obtenerPaisPorId,
    buscar,
    crearPais,
    actualizarPais,
    eliminarPaisPorId,
    eliminarPaisPorCampo
} = require('../controllers/paisesController');

// Rutas públicas - cualquiera puede consultar
router.get('/', obtenerTodosLosPaises);
router.get('/buscar', buscar);
router.get('/:id', obtenerPaisPorId);

// Rutas solo para admin
router.post('/', verifyToken, isAdmin, crearPais);
router.put('/:id', verifyToken, isAdmin, actualizarPais);
router.patch('/:id', verifyToken, isAdmin, actualizarPais);
router.delete('/eliminar', verifyToken, isAdmin, eliminarPaisPorCampo);
router.delete('/:id', verifyToken, isAdmin, eliminarPaisPorId);

module.exports = router;