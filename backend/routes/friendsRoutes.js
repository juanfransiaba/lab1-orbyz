const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');

const {
    sendFriendRequest,
    getReceivedRequests,
    getSentRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    getFriends,
    removeFriendship,
} = require('../controllers/friendsController');

// Todas las rutas requieren estar logueado
router.use(verifyToken);

router.get('/', getFriends);
router.post('/request', sendFriendRequest);
router.get('/requests/received', getReceivedRequests);
router.get('/requests/sent', getSentRequests);
router.put('/:friendshipId/accept', acceptFriendRequest);
router.put('/:friendshipId/reject', rejectFriendRequest);
router.delete('/:friendshipId', removeFriendship);

module.exports = router;