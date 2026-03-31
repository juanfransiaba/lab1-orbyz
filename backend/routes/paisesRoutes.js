const express = require('express');
const router = express.Router();
const {
    obtenerTodosLosPaises,
    obtenerPaisPorId,
    buscar,
    crearPais,
    actualizarPais,
    eliminarPais
} = require('../controllers/paisesController');

router.get('/', obtenerTodosLosPaises);
router.get('/buscar', buscar);
router.get('/:id', obtenerPaisPorId);
router.post('/', crearPais);
router.put('/:id', actualizarPais);
router.patch('/:id', actualizarPais);
router.delete('/:id', eliminarPais);

module.exports = router;