const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;

function validateUsername(username) {
    if (typeof username !== "string") {
        return "El usuario es inválido";
    }

    if (!USERNAME_REGEX.test(username)) {
        return "El usuario debe tener entre 3 y 20 caracteres (solo letras, números y guión bajo).";
    }

    return null;
}

function validateEmail(email) {
    if (typeof email !== "string") {
        return "El email es inválido";
    }

    if (email.length > EMAIL_MAX_LENGTH) {
        return "El email es demasiado largo.";
    }

    if (!EMAIL_REGEX.test(email)) {
        return "El email no tiene un formato válido.";
    }

    return null;
}

module.exports = { validateUsername, validateEmail };