const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_APP_PASSWORD,
    },
});

// Mail de "te pasaron en el ranking"
async function sendRankingPassedEmail({ to, toUsername, passerUsername, newScore }) {
    if (!process.env.MAIL_USER || !process.env.MAIL_APP_PASSWORD) {
        console.warn("Mailer no configurado (faltan MAIL_USER / MAIL_APP_PASSWORD)");
        return;
    }

    await transporter.sendMail({
        from: `"Geography Game System" <${process.env.MAIL_USER}>`,
        to,
        subject: `${passerUsername} te pasó en el ranking`,
        text:
            `Hola ${toUsername},\n\n` +
            `${passerUsername} te superó en el ranking de amigos (ahora tiene ${newScore} puntos).\n` +
            `¡Entrá a jugar una partida online para recuperar tu puesto!\n\n` +
            `— Geography Game System`,
    });
}

module.exports = { sendRankingPassedEmail };