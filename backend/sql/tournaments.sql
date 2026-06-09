CREATE TABLE IF NOT EXISTS tournaments (
    tournament_id SERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    code VARCHAR(8) NOT NULL UNIQUE,
    created_by INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    mode VARCHAR(40) NOT NULL CHECK (
        mode IN (
            'country-by-capital',
            'capital-by-country',
            'country-by-shape',
            'country-by-continent'
        )
    ),
    continent VARCHAR(30),
    max_players INTEGER NOT NULL CHECK (max_players IN (4, 8, 16)),
    status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (
        status IN ('waiting', 'active', 'finished', 'cancelled')
    ),
    winner_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (mode = 'country-by-continent' AND continent IS NOT NULL)
        OR
        (mode <> 'country-by-continent')
    )
);

CREATE TABLE IF NOT EXISTS tournament_participants (
    participant_id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    eliminated BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
    tournament_match_id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    match_order INTEGER NOT NULL,
    player1_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    player2_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    winner_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    online_room_code VARCHAR(12),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'ready', 'playing', 'finished', 'bye')
    ),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tournament_id, round_number, match_order)
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status_created
    ON tournaments(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_user
    ON tournament_participants(user_id, tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_round
    ON tournament_matches(tournament_id, round_number, match_order);
