const PASSWORD_MIN_LENGTH = 8;

function validatePassword(password) {
    if (typeof password !== "string") {
        return "La contraseña es inválida";
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
        return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;
    }

    if (!/[0-9]/.test(password)) {
        return "La contraseña debe contener al menos un número";
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        return "La contraseña debe contener al menos un carácter especial";
    }

    return null;
}

module.exports = { validatePassword };