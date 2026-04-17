const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/adminMiddleware');

const {
    getUsers,
    getUserById,
    getProfile,
    updateProfile,
    updateUserRole,
    deleteProfile
} = require('../controllers/userController');


router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, updateProfile);
router.delete('/profile', verifyToken, deleteProfile);

router.get('/', verifyToken, isAdmin, getUsers);
router.get('/:id', verifyToken, isAdmin, getUserById);
router.put('/:id/role', verifyToken, isAdmin, updateUserRole);

module.exports = router;
