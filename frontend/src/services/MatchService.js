const API_URL = import.meta.env.VITE_API_URL;

function getToken() {
    return localStorage.getItem("token");
}

async function requestJSON(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        headers: {
            "Content-Type": "application/json",
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
            ...(options.headers || {}),
        },
        ...options,
    });

    const contentType = response.headers.get("content-type") || "";
    const hasJsonBody = contentType.includes("application/json");
    const data = hasJsonBody ? await response.json() : null;

    if (!response.ok) {
        throw new Error(
            data?.message || data?.error || `La solicitud a ${path} fallo.`
        );
    }

    return data;
}

function normalizeMatch(match) {
    return {
        id: match?.match_id ?? match?.matchId ?? match?.id ?? "",
        userId: match?.user_id ?? match?.userId ?? "",
        mode: match?.mode ?? "",
        status: match?.status ?? "ongoing",
        continent: match?.continent ?? "",
        score: match?.score ?? 0,
        correctCount: match?.correct_count ?? match?.correctCount ?? 0,
        wrongCount: match?.wrong_count ?? match?.wrongCount ?? 0,
        roundReached: match?.round_reached ?? match?.roundReached ?? 0,
        totalRounds: match?.total_rounds ?? match?.totalRounds ?? 0,
        livesLeft: match?.lives_left ?? match?.livesLeft ?? 0,
        metadata: match?.metadata ?? {},
        startedAt: match?.started_at ?? match?.startedAt ?? null,
        finishedAt: match?.finished_at ?? match?.finishedAt ?? null,
        updatedAt: match?.updated_at ?? match?.updatedAt ?? null,
    };
}

function normalizeContextValue(value) {
    return String(value || "").trim().toLowerCase();
}

function getResumeStorageKey(mode, continent = "") {
    return `orbyz:resume-match:${normalizeContextValue(mode)}:${normalizeContextValue(
        continent
    )}`;
}

function matchesContext(match, mode, continent = "") {
    const sameMode = match?.mode === mode;
    const sameContinent =
        !continent ||
        normalizeContextValue(match?.continent) === normalizeContextValue(continent);

    return sameMode && sameContinent;
}

function getRememberedResumeMatchId(mode, continent = "") {
    try {
        return sessionStorage.getItem(getResumeStorageKey(mode, continent));
    } catch {
        return "";
    }
}

function clearRememberedResumeMatch(mode, continent = "") {
    try {
        sessionStorage.removeItem(getResumeStorageKey(mode, continent));
    } catch {
        // no-op
    }
}

export function rememberResumeMatch(match) {
    if (!match?.id || !match?.mode) {
        return;
    }

    try {
        sessionStorage.setItem(
            getResumeStorageKey(match.mode, match.continent),
            String(match.id)
        );
    } catch {
        // no-op
    }
}

export async function createMatch(payload) {
    const data = await requestJSON("/matches", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return normalizeMatch(data);
}

export async function updateMatch(matchId, payload) {
    const data = await requestJSON(`/matches/${matchId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });

    return normalizeMatch(data);
}

export async function getMatchById(matchId) {
    const data = await requestJSON(`/matches/${matchId}`);

    return normalizeMatch(data);
}

export async function getMyMatches({
    page = 1,
    limit = 8,
    status = "",
    kind = "",
} = {}) {
    const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
    });

    if (status) {
        query.set("status", status);
    }

    if (kind) {
        query.set("kind", kind);
    }

    const data = await requestJSON(`/matches?${query.toString()}`);

    return {
        data: Array.isArray(data?.data) ? data.data.map(normalizeMatch) : [],
        pagination: {
            page: data?.pagination?.page ?? page,
            limit: data?.pagination?.limit ?? limit,
            total: data?.pagination?.total ?? 0,
            totalPages: data?.pagination?.totalPages ?? 0,
        },
    };
}

export async function abandonMatch(matchId) {
    return updateMatch(matchId, {
        status: "abandoned",
        metadata: {
            resultState: "abandoned",
        },
    });
}

// Busca tu partida en curso (ongoing) de un modo (y continente si aplica)
export async function findOngoingMatch(mode, continent = "") {
    const rememberedMatchId = getRememberedResumeMatchId(mode, continent);

    if (rememberedMatchId) {
        try {
            const rememberedMatch = await getMatchById(rememberedMatchId);

            if (
                rememberedMatch.status === "ongoing" &&
                matchesContext(rememberedMatch, mode, continent)
            ) {
                return rememberedMatch;
            }

            clearRememberedResumeMatch(mode, continent);
        } catch {
            clearRememberedResumeMatch(mode, continent);
        }
    }

    const { data } = await getMyMatches({ status: "ongoing", limit: 30 });

    return (
        data
            .filter(
                (m) =>
                    m.mode === mode &&
                    (!continent ||
                        normalizeContextValue(m.continent) ===
                            normalizeContextValue(continent))
            )
            .sort(
                (a, b) =>
                    new Date(b.updatedAt || b.startedAt || 0) -
                    new Date(a.updatedAt || a.startedAt || 0)
            )[0] || null
    );
}
