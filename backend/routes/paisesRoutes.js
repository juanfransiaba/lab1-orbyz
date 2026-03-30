const express = require('express');
const router = express.Router();
const { buscarPaisPorNombre } = require('../controllers/paisesController');

router.get('/buscar/:nombre', buscarPaisPorNombre);

module.exports = router;