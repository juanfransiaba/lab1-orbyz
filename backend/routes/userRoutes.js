const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/adminMiddleware');  // ← agregado

const {
    getUsers,
    getUserById,
    getProfile,
    updateProfile,
    deleteProfile
} = require('../controllers/userController');

// Rutas propias del usuario autenticado
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, updateProfile);
router.delete('/profile', verifyToken, deleteProfile);

// Rutas solo para admin
router.get('/', verifyToken, isAdmin, getUsers);
router.get('/:id', verifyToken, isAdmin, getUserById);

module.exports = router;