const express = require('express');
const router = express.Router();

const {
    register,
    login,
    logout,
    startOAuthLogin,
    finishOAuthLogin
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/oauth/:provider', startOAuthLogin);
router.get('/oauth/:provider/callback', finishOAuthLogin);

module.exports = router;
