const API_URL = import.meta.env.VITE_API_URL;

import { getSocket } from "./socket";

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
    const data = contentType.includes("application/json") ? await response.json() : null;

    if (!response.ok) {
        throw new Error(data?.message || data?.error || "No se pudo cargar torneos.");
    }

    return data;
}

function normalizeTournament(tournament) {
    if (!tournament) {
        return null;
    }

    return {
        id: tournament.tournament_id ?? tournament.tournamentId ?? tournament.id,
        name: tournament.name ?? "",
        code: tournament.code ?? "",
        createdBy: tournament.created_by ?? tournament.createdBy,
        creatorUsername:
            tournament.creator_username ?? tournament.creatorUsername ?? "Jugador",
        mode: tournament.mode ?? "",
        continent: tournament.continent ?? "",
        maxPlayers: Number(tournament.max_players ?? tournament.maxPlayers) || 4,
        status: tournament.status ?? "waiting",
        winnerUserId: tournament.winner_user_id ?? tournament.winnerUserId ?? null,
        winnerUsername: tournament.winner_username ?? tournament.winnerUsername ?? "",
        participantCount:
            Number(tournament.participant_count ?? tournament.participantCount) || 0,
        isCreator: Boolean(tournament.is_creator ?? tournament.isCreator),
        isJoined: Boolean(tournament.is_joined ?? tournament.isJoined),
        createdAt: tournament.created_at ?? tournament.createdAt ?? null,
        startedAt: tournament.started_at ?? tournament.startedAt ?? null,
        finishedAt: tournament.finished_at ?? tournament.finishedAt ?? null,
        updatedAt: tournament.updated_at ?? tournament.updatedAt ?? null,
    };
}

function normalizeParticipant(participant) {
    return {
        id: participant.participant_id ?? participant.participantId,
        tournamentId: participant.tournament_id ?? participant.tournamentId,
        userId: participant.user_id ?? participant.userId,
        username: participant.username ?? "Jugador",
        eliminated: Boolean(participant.eliminated),
        joinedAt: participant.joined_at ?? participant.joinedAt ?? null,
    };
}

function normalizeMatch(match) {
    return {
        id: match.tournament_match_id ?? match.tournamentMatchId ?? match.id,
        tournamentId: match.tournament_id ?? match.tournamentId,
        roundNumber: Number(match.round_number ?? match.roundNumber) || 1,
        matchOrder: Number(match.match_order ?? match.matchOrder) || 1,
        player1Id: match.player1_id ?? match.player1Id ?? null,
        player1Username: match.player1_username ?? match.player1Username ?? "",
        player2Id: match.player2_id ?? match.player2Id ?? null,
        player2Username: match.player2_username ?? match.player2Username ?? "",
        winnerUserId: match.winner_user_id ?? match.winnerUserId ?? null,
        winnerUsername: match.winner_username ?? match.winnerUsername ?? "",
        onlineRoomCode: match.online_room_code ?? match.onlineRoomCode ?? "",
        status: match.status ?? "pending",
        createdAt: match.created_at ?? match.createdAt ?? null,
        updatedAt: match.updated_at ?? match.updatedAt ?? null,
    };
}

function normalizeSnapshot(snapshot) {
    return {
        tournament: normalizeTournament(snapshot?.tournament),
        participants: Array.isArray(snapshot?.participants)
            ? snapshot.participants.map(normalizeParticipant)
            : [],
        matches: Array.isArray(snapshot?.matches)
            ? snapshot.matches.map(normalizeMatch)
            : [],
    };
}

export async function getTournament(tournamentId) {
    const data = await requestJSON(`/tournaments/${tournamentId}`);
    return normalizeSnapshot(data);
}

export async function getCurrentTournament() {
    const data = await requestJSON("/tournaments/current");
    return normalizeSnapshot(data);
}

export async function createTournament(payload) {
    const data = await requestJSON("/tournaments", {
        method: "POST",
        body: JSON.stringify(payload),
    });

    return normalizeSnapshot(data);
}

export async function updateTournament(tournamentId, payload) {
    const data = await requestJSON(`/tournaments/${tournamentId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });

    return normalizeSnapshot(data);
}

export async function deleteTournament(tournamentId) {
    return requestJSON(`/tournaments/${tournamentId}`, {
        method: "DELETE",
    });
}

export async function joinTournament(tournamentId) {
    const data = await requestJSON(`/tournaments/${tournamentId}/join`, {
        method: "POST",
    });

    return normalizeSnapshot(data);
}

export async function joinTournamentByCode(code) {
    const data = await requestJSON("/tournaments/join-code", {
        method: "POST",
        body: JSON.stringify({ code }),
    });

    return normalizeSnapshot(data);
}

export async function leaveTournament(tournamentId) {
    const data = await requestJSON(`/tournaments/${tournamentId}/leave`, {
        method: "POST",
    });

    return normalizeSnapshot(data);
}

export async function startTournament(tournamentId) {
    const data = await requestJSON(`/tournaments/${tournamentId}/start`, {
        method: "POST",
    });

    return normalizeSnapshot(data);
}

export function watchTournament(tournamentId) {
    getSocket().emit("tournament:watch", { tournamentId });
}

export function unwatchTournament(tournamentId) {
    getSocket().emit("tournament:unwatch", { tournamentId });
}

export function onTournamentUpdated(handler) {
    const s = getSocket();
    s.on("tournament:updated", handler);
    return () => s.off("tournament:updated", handler);
}

export function onTournamentDeleted(handler) {
    const s = getSocket();
    s.on("tournament:deleted", handler);
    return () => s.off("tournament:deleted", handler);
}

export async function kickParticipant(tournamentId, userId) {
    const data = await requestJSON(
        `/tournaments/${tournamentId}/participants/${userId}`,
        { method: "DELETE" }
    );
    return normalizeSnapshot(data);
}

export function onTournamentKicked(handler) {
    const s = getSocket();
    s.on("tournament:kicked", handler);
    return () => s.off("tournament:kicked", handler);
}
