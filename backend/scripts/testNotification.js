require("dotenv").config();
const pool = require("../db");
const { sendRankingPassedEmail } = require("../utils/mailer");

const identifier = process.argv[2];             // username o email del que RECIBE
const passerName = process.argv[3] || "Tester"; // nombre del que "lo pasó"

if (!identifier) {
    console.error(
        "Uso: node scripts/testNotification.js <username-o-email-del-que-recibe> [nombreDelQueLoPaso]"
    );
    process.exit(1);
}

(async () => {
    try {
        const { rows } = await pool.query(
            `SELECT user_id, username, email FROM users
             WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)`,
            [identifier.trim()]
        );

        if (rows.length === 0) {
            console.error("No existe ningún usuario con ese username/email");
            process.exit(1);
        }

        const user = rows[0];

        await pool.query(
            `INSERT INTO notifications (user_id, type, payload)
             VALUES ($1, 'ranking_passed', $2)`,
            [user.user_id, JSON.stringify({ passerUsername: passerName, newScore: 999 })]
        );
        console.log(`Notificación creada para ${user.username} (user_id ${user.user_id})`);

        if (user.email) {
            await sendRankingPassedEmail({
                to: user.email,
                toUsername: user.username,
                passerUsername: passerName,
                newScore: 999,
            });
            console.log(`Mail enviado a ${user.email}`);
        } else {
            console.log("El usuario no tiene email cargado, no se mandó mail");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
})();