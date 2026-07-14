const fetch = require("node-fetch");

const MERCADO_PAGO_API_URL = "https://api.mercadopago.com";

function getAccessToken() {
    return process.env.MP_ACCESS_TOKEN || process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
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
        const error = new Error(
            data.message || data.error || "Mercado Pago rechazo la solicitud"
        );
        error.status = response.status;
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
