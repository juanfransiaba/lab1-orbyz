const fetch = require("node-fetch");

const MERCADO_PAGO_API_URL = "https://api.mercadopago.com";

function getAccessToken() {
    const rawToken =
        process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || "";

    return String(rawToken)
        .trim()
        .replace(/^Bearer\s+/i, "")
        .replace(/^['"]|['"]$/g, "");
}

function isMercadoPagoConfigured() {
    return Boolean(getAccessToken());
}

async function mercadoPagoRequest(path, options = {}) {
    const accessToken = getAccessToken();

    if (!accessToken) {
        const error = new Error("Mercado Pago no esta configurado");
        error.code = "MERCADO_PAGO_NOT_CONFIGURED";
        throw error;
    }

    const response = await fetch(`${MERCADO_PAGO_API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            ...(options.headers || {}),
        },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const mercadoPagoCode = String(data.code || data.error || "").toUpperCase();
        const mercadoPagoMessage = String(data.message || "");
        const isUnauthorizedPolicy =
            response.status === 401 ||
            response.status === 403 ||
            mercadoPagoCode.includes("UNAUTHORIZED") ||
            mercadoPagoMessage.toUpperCase().includes("UNAUTHORIZED");

        const error = new Error(
            isUnauthorizedPolicy
                ? "Mercado Pago rechazo la credencial del servidor. Revisa MP_ACCESS_TOKEN en Railway: tiene que ser el Access Token de la cuenta vendedora, no la Public Key, sin comillas y con permisos de pago."
                : data.message || data.error || "Mercado Pago rechazo la solicitud"
        );
        error.status = response.status;
        error.code = isUnauthorizedPolicy
            ? "MERCADO_PAGO_UNAUTHORIZED"
            : "MERCADO_PAGO_ERROR";
        error.details = data;
        throw error;
    }

    return data;
}

function createPreference(preference) {
    return mercadoPagoRequest("/checkout/preferences", {
        method: "POST",
        body: JSON.stringify(preference),
    });
}

function getPayment(paymentId) {
    return mercadoPagoRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

function searchPayments(params = {}) {
    const searchParams = new URLSearchParams(params);

    return mercadoPagoRequest(`/v1/payments/search?${searchParams.toString()}`);
}

module.exports = {
    createPreference,
    getPayment,
    isMercadoPagoConfigured,
    searchPayments,
};
