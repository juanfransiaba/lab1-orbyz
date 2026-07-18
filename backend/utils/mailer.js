const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_APP_PASSWORD,
    },
});

function getFrontendBase() {
    return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ─────────────────────────────────────────────
// Mail "te pasaron en el ranking"
// ─────────────────────────────────────────────
function buildRankingPassedHtml({ toUsername, passerUsername, newScore, playUrl }) {
    const safeTo = escapeHtml(toUsername);
    const safePasser = escapeHtml(passerUsername);
    const safeScore = escapeHtml(newScore);

    return `
    <div style="margin:0;padding:0;background-color:#eef4ff;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef4ff;padding:24px 0;">
        <tr><td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,32,61,0.12);">
            <tr><td style="background:linear-gradient(135deg,#08152c 0%,#0f264c 55%,#1f4e8c 100%);padding:28px 32px;text-align:center;">
              <div style="color:#93b4e8;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">Geography Game System</div>
              <div style="color:#ffffff;font-size:26px;font-weight:bold;margin-top:6px;">Orbyz</div>
            </td></tr>
            <tr><td style="padding:32px;">
              <h1 style="margin:0 0 8px;color:#0f264c;font-size:22px;">${safePasser} te pasó en el ranking 🏆</h1>
              <p style="margin:0 0 18px;color:#3f4a5a;font-size:15px;line-height:1.6;">
                Hola <strong>${safeTo}</strong>, <strong>${safePasser}</strong> te superó en el ranking de amigos y ahora tiene <strong>${safeScore} puntos</strong>.
              </p>
              <p style="margin:0 0 26px;color:#3f4a5a;font-size:15px;line-height:1.6;">
                ¿Le vas a dejar el primer puesto así nomás? Entrá y jugá una partida online para recuperar tu lugar.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
                <td style="border-radius:12px;background:linear-gradient(135deg,#1f4e8c 0%,#0f264c 100%);">
                  <a href="${playUrl}" target="_blank" style="display:inline-block;padding:14px 34px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;border-radius:12px;">Jugar ahora</a>
                </td>
              </tr></table>
              <p style="margin:22px 0 0;color:#8a94a6;font-size:12px;line-height:1.5;text-align:center;">
                Si el botón no funciona, copiá y pegá este link:<br>
                <a href="${playUrl}" style="color:#1f4e8c;">${playUrl}</a>
              </p>
            </td></tr>
            <tr><td style="background-color:#f4f7fc;padding:18px 32px;text-align:center;color:#8a94a6;font-size:12px;">
              Recibiste este mail porque un amigo te superó en el ranking de Orbyz.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </div>`;
}

async function sendRankingPassedEmail({ to, toUsername, passerUsername, newScore }) {
    if (!process.env.MAIL_USER || !process.env.MAIL_APP_PASSWORD) {
        console.warn("Mailer no configurado (faltan MAIL_USER / MAIL_APP_PASSWORD)");
        return;
    }

    const playUrl = `${getFrontendBase()}/online`;

    await transporter.sendMail({
        from: `"Orbyz" <${process.env.MAIL_USER}>`,
        to,
        subject: `${passerUsername} te pasó en el ranking 🏆`,
        text:
            `Hola ${toUsername},\n\n` +
            `${passerUsername} te superó en el ranking de amigos (ahora tiene ${newScore} puntos).\n` +
            `Entrá a jugar una partida online para recuperar tu puesto:\n` +
            `${playUrl}\n\n— Orbyz`,
        html: buildRankingPassedHtml({ toUsername, passerUsername, newScore, playUrl }),
    });
}

// ─────────────────────────────────────────────
// Mail "te invitaron a una sala online" (link + QR, responsive)
// ─────────────────────────────────────────────
function buildRoomInviteHtml({ toUsername, fromUsername, code, joinUrl, qrUrl }) {
    const safeTo = escapeHtml(toUsername);
    const safeFrom = escapeHtml(fromUsername);
    const safeCode = escapeHtml(code);

    return `
    <div style="margin:0;padding:0;background-color:#eef4ff;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef4ff;padding:24px 0;">
        <tr><td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,32,61,0.12);">
            <tr><td style="background:linear-gradient(135deg,#08152c 0%,#0f264c 55%,#1f4e8c 100%);padding:28px 32px;text-align:center;">
              <div style="color:#93b4e8;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;">Geography Game System</div>
              <div style="color:#ffffff;font-size:26px;font-weight:bold;margin-top:6px;">Orbyz</div>
            </td></tr>
            <tr><td style="padding:32px;text-align:center;">
              <h1 style="margin:0 0 8px;color:#0f264c;font-size:22px;">${safeFrom} te invitó a jugar 🎮</h1>
              <p style="margin:0 0 20px;color:#3f4a5a;font-size:15px;line-height:1.6;">
                Hola <strong>${safeTo}</strong>, <strong>${safeFrom}</strong> te invitó a una partida online en Orbyz.
                Entrá al link o escaneá el QR. Si no tenés sesión iniciada, primero hacés login (o te registrás) y caés directo en la sala.
              </p>
              <div style="margin:0 0 18px;color:#0f264c;font-size:14px;">Código de sala</div>
              <div style="display:inline-block;padding:10px 22px;border-radius:12px;background:#eef4ff;color:#0f264c;font-size:24px;font-weight:bold;letter-spacing:4px;margin-bottom:24px;">${safeCode}</div>
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 24px;"><tr>
                <td style="border-radius:12px;background:linear-gradient(135deg,#1f4e8c 0%,#0f264c 100%);">
                  <a href="${joinUrl}" target="_blank" style="display:inline-block;padding:14px 40px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;border-radius:12px;">Entrar a la sala</a>
                </td>
              </tr></table>
              <div style="margin:0 0 8px;color:#8a94a6;font-size:12px;">o escaneá este QR desde el celu</div>
              <img src="${qrUrl}" alt="QR para entrar a la sala" width="200" height="200" style="width:200px;max-width:60%;height:auto;border-radius:12px;border:1px solid #e2e8f0;" />
              <p style="margin:22px 0 0;color:#8a94a6;font-size:12px;line-height:1.5;">
                Si el botón no funciona, copiá y pegá este link:<br>
                <a href="${joinUrl}" style="color:#1f4e8c;word-break:break-all;">${joinUrl}</a>
              </p>
            </td></tr>
            <tr><td style="background-color:#f4f7fc;padding:18px 32px;text-align:center;color:#8a94a6;font-size:12px;">
              Recibiste este mail porque un amigo te invitó a jugar en Orbyz.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </div>`;
}

async function sendRoomInviteEmail({ to, toUsername, fromUsername, code }) {
    if (!process.env.MAIL_USER || !process.env.MAIL_APP_PASSWORD) {
        console.warn("Mailer no configurado (faltan MAIL_USER / MAIL_APP_PASSWORD)");
        return;
    }

    const joinUrl = `${getFrontendBase()}/online/join?code=${encodeURIComponent(code)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(
        joinUrl
    )}`;

    await transporter.sendMail({
        from: `"Orbyz" <${process.env.MAIL_USER}>`,
        to,
        subject: `${fromUsername} te invitó a jugar en Orbyz`,
        text:
            `Hola ${toUsername},\n\n` +
            `${fromUsername} te invitó a una partida online en Orbyz (código de sala: ${code}).\n` +
            `Entrá con este link (si no tenés sesión iniciada, primero login/registro):\n` +
            `${joinUrl}\n\n— Orbyz`,
        html: buildRoomInviteHtml({ toUsername, fromUsername, code, joinUrl, qrUrl }),
    });
}

module.exports = { sendRankingPassedEmail, sendRoomInviteEmail };