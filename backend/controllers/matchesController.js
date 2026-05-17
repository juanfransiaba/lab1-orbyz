const pool = require("../db");

const ALLOWED_STATUSES = new Set(["ongoing", "completed", "abandoned"]);

function normalizeMatch(row) {
    if (!row) {
        return row;
    }

    return {
        ...row,
        metadata: row.metadata ?? {},
    };
}

const createMatch = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const {
            mode,
            continent = null,
            total_rounds = 0,
            lives_left = 0,
            metadata = {},
        } = req.body;

        if (!mode || !String(mode).trim()) {
            return res.status(400).json({ message: "El modo es obligatorio" });
        }

        const { rows } = await pool.query(
            `INSERT INTO matches (
                user_id,
                mode,
                status,
                continent,
                total_rounds,
                lives_left,
                metadata
            )
            VALUES ($1, $2, 'ongoing', $3, $4, $5, $6)
            RETURNING *`,
            [
                userId,
                String(mode).trim(),
                continent ? String(continent).trim() : null,
                Number(total_rounds) || 0,
                Number(lives_left) || 0,
                metadata ?? {},
            ]
        );

        res.status(201).json(normalizeMatch(rows[0]));
    } catch (error) {
        console.error("Error en createMatch:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const updateMatch = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { matchId } = req.params;
        const {
            status,
            score,
            correct_count,
            wrong_count,
            round_reached,
            total_rounds,
            lives_left,
            continent,
            metadata,
        } = req.body;

        const existing = await pool.query(
            "SELECT match_id FROM matches WHERE match_id = $1 AND user_id = $2",
            [matchId, userId]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ message: "Partida no encontrada" });
        }

        const fields = [];
        const values = [];
        let index = 1;

        if (status !== undefined) {
            if (!ALLOWED_STATUSES.has(status)) {
                return res.status(400).json({ message: "Estado de partida invalido" });
            }

            fields.push(`status = $${index++}`);
            values.push(status);
        }

        if (score !== undefined) {
            fields.push(`score = $${index++}`);
            values.push(Number(score) || 0);
        }

        if (correct_count !== undefined) {
            fields.push(`correct_count = $${index++}`);
            values.push(Number(correct_count) || 0);
        }

        if (wrong_count !== undefined) {
            fields.push(`wrong_count = $${index++}`);
            values.push(Number(wrong_count) || 0);
        }

        if (round_reached !== undefined) {
            fields.push(`round_reached = $${index++}`);
            values.push(Number(round_reached) || 0);
        }

        if (total_rounds !== undefined) {
            fields.push(`total_rounds = $${index++}`);
            values.push(Number(total_rounds) || 0);
        }

        if (lives_left !== undefined) {
            fields.push(`lives_left = $${index++}`);
            values.push(Number(lives_left) || 0);
        }

        if (continent !== undefined) {
            fields.push(`continent = $${index++}`);
            values.push(continent ? String(continent).trim() : null);
        }

        if (metadata !== undefined) {
            fields.push(`metadata = $${index++}`);
            values.push(metadata ?? {});
        }

        if (fields.length === 0) {
            return res.status(400).json({ message: "No hay campos para actualizar" });
        }

        if (status === "completed" || status === "abandoned") {
            fields.push("finished_at = CURRENT_TIMESTAMP");
        }

        fields.push("updated_at = CURRENT_TIMESTAMP");

        values.push(matchId, userId);

        const { rows } = await pool.query(
            `UPDATE matches
             SET ${fields.join(", ")}
             WHERE match_id = $${index++} AND user_id = $${index}
             RETURNING *`,
            values
        );

        res.json(normalizeMatch(rows[0]));
    } catch (error) {
        console.error("Error en updateMatch:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const getMyMatches = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 50);
        const offset = (page - 1) * limit;
        const status = String(req.query.status || "").trim().toLowerCase();

        let whereClause = "WHERE user_id = $1";
        const baseParams = [userId];

        if (status) {
            if (!ALLOWED_STATUSES.has(status)) {
                return res.status(400).json({ message: "Filtro de estado invalido" });
            }

            whereClause += " AND status = $2";
            baseParams.push(status);
        }

        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM matches
             ${whereClause}`,
            baseParams
        );

        const total = countResult.rows[0]?.total ?? 0;
        const queryParams = [...baseParams, limit, offset];
        const limitIndex = queryParams.length - 1;
        const offsetIndex = queryParams.length;

        const { rows } = await pool.query(
            `SELECT *
             FROM matches
             ${whereClause}
             ORDER BY
                CASE WHEN status = 'ongoing' THEN 0 ELSE 1 END,
                updated_at DESC,
                match_id DESC
             LIMIT $${limitIndex}
             OFFSET $${offsetIndex}`,
            queryParams
        );

        res.json({
            data: rows.map(normalizeMatch),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("Error en getMyMatches:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

const getMatchById = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { matchId } = req.params;

        const { rows } = await pool.query(
            "SELECT * FROM matches WHERE match_id = $1 AND user_id = $2",
            [matchId, userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Partida no encontrada" });
        }

        res.json(normalizeMatch(rows[0]));
    } catch (error) {
        console.error("Error en getMatchById:", error);
        res.status(500).json({ message: "Error del servidor" });
    }
};

module.exports = {
    createMatch,
    updateMatch,
    getMyMatches,
    getMatchById,
};
