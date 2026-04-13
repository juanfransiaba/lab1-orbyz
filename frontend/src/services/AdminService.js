const API_URL = import.meta.env.VITE_API_URL;

function getToken() {
    return localStorage.getItem("token");
}

function buildUrl(path) {
    return `${API_URL}${path}`;
}

function buildHeaders(customHeaders = {}) {
    const token = getToken();

    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...customHeaders,
    };
}

function normalizeCountry(country) {
    return {
        id: country?.id ?? country?.id_pais ?? country?._id ?? "",
        nombre: country?.nombre ?? "",
        capital: country?.capital ?? "",
        continente: country?.continente ?? "",
        imagen_pais: country?.imagen_pais ?? country?.imagenPais ?? "",
        imagen_silueta: country?.imagen_silueta ?? country?.imagenSilueta ?? "",
    };
}

function normalizeAnswer(answer) {
    return {
        id: answer?.id ?? answer?._id ?? `answer-${Math.random().toString(16).slice(2)}`,
        texto: answer?.texto ?? answer?.respuesta ?? answer?.text ?? "",
        esCorrecta: Boolean(
            answer?.esCorrecta ?? answer?.correcta ?? answer?.isCorrect ?? answer?.correct
        ),
    };
}

function normalizeQuestion(question) {
    const answersSource = question?.respuestas ?? question?.answers ?? [];

    return {
        id: question?.id ?? question?._id ?? "",
        pregunta: question?.pregunta ?? question?.texto ?? question?.question ?? "",
        paisId: question?.paisId ?? question?.pais_id ?? question?.countryId ?? "",
        respuestas: Array.isArray(answersSource) ? answersSource.map(normalizeAnswer) : [],
    };
}

function normalizeUser(user) {
    return {
        id: user?.id ?? user?.user_id ?? user?._id ?? "",
        nombre:
            user?.nombre ??
            user?.username ??
            user?.name ??
            [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim(),
        email: user?.email ?? "",
        role: user?.role ?? user?.rol ?? user?.roles ?? "user",
        score: user?.score ?? 0,
    };
}

async function requestJSON(path, options = {}) {
    const response = await fetch(buildUrl(path), {
        headers: buildHeaders(options.headers),
        ...options,
    });

    const contentType = response.headers.get("content-type") || "";
    const hasJsonBody = contentType.includes("application/json");
    const data = hasJsonBody ? await response.json() : null;

    if (!response.ok) {
        throw new Error(
            data?.message ||
            data?.error ||
            `La solicitud a ${path} fallo con estado ${response.status}.`
        );
    }

    return data;
}

export async function getCountries() {
    const data = await requestJSON("/api/paises");
    return Array.isArray(data) ? data.map(normalizeCountry) : [];
}

export async function getRandomCountries(limit = 4) {
    const data = await requestJSON(`/api/paises/random?limit=${limit}`);
    return Array.isArray(data) ? data.map(normalizeCountry) : [];
}

export async function getRandomCountriesByContinent(continent, limit = 4) {
    const data = await requestJSON(
        `/api/paises/continente/${encodeURIComponent(continent)}/random?limit=${limit}`
    );
    return Array.isArray(data) ? data.map(normalizeCountry) : [];
}

export async function createCountry(payload) {
    return requestJSON("/api/paises", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function updateCountry(id, payload) {
    return requestJSON(`/api/paises/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

export async function deleteCountry(id) {
    return requestJSON(`/api/paises/${id}`, {
        method: "DELETE",
    });
}

export async function getQuestions() {
    const data = await requestJSON("/api/preguntas");
    return Array.isArray(data) ? data.map(normalizeQuestion) : [];
}

export async function createQuestion(payload) {
    return requestJSON("/api/preguntas", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function updateQuestion(id, payload) {
    return requestJSON(`/api/preguntas/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

export async function deleteQuestion(id) {
    return requestJSON(`/api/preguntas/${id}`, {
        method: "DELETE",
    });
}

export async function getUsers() {
    const data = await requestJSON("/user");
    return Array.isArray(data) ? data.map(normalizeUser) : [];
}

export async function updateUserRole(id, role) {
    return requestJSON(`/user/${id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
    });
}
