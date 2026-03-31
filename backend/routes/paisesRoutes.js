const express = require('express');
const router = express.Router();
const {
    obtenerTodosLosPaises,
    obtenerPaisPorId,
    buscar,
    crearPais,
    actualizarPais,
    eliminarPaisPorId,
    eliminarPaisPorCampo,
} = require('../controllers/paisesController');

router.get('/', obtenerTodosLosPaises);
router.get('/buscar', buscar);
router.get('/:id', obtenerPaisPorId);
router.post('/', crearPais);
router.put('/:id', actualizarPais);
router.patch('/:id', actualizarPais);
router.delete('/:id', eliminarPaisPorId);
router.delete('/eliminar', eliminarPaisPorCampo);



module.exports = router;