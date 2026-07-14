const pool = require("../db");
const { ensureStoreTables, getAvatarProfile } = require("./storeService");

async function getPublicPlayerProfile(userId, fallbackUsername) {
    await ensureStoreTables();

    const { rows } = await pool.query(
        `SELECT username, profile_avatar_id
         FROM users
         WHERE user_id = $1`,
        [userId]
    );

    const user = rows[0] || {};
    const avatar = getAvatarProfile(user.profile_avatar_id);

    return {
        username: user.username || fallbackUsername || `user-${userId}`,
        avatar,
    };
}

module.exports = {
    getPublicPlayerProfile,
};
