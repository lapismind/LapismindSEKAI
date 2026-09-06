-- Migration 005: Abracadawhat schema v2 and idempotent match reports.

ALTER TABLE matches ADD COLUMN report_id TEXT;

ALTER TABLE match_players ADD COLUMN dragon_kills INTEGER NOT NULL DEFAULT 0;
ALTER TABLE match_players ADD COLUMN round_wins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE match_players ADD COLUMN round_win_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE match_players ADD COLUMN survival_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE match_players ADD COLUMN secret_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE match_players ADD COLUMN round_wins_by_reason TEXT NOT NULL DEFAULT '{}';
ALTER TABLE match_players ADD COLUMN max_turn_cast_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE match_players ADD COLUMN max_turn_distinct_spells INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX idx_matches_report_id ON matches(report_id) WHERE report_id IS NOT NULL;
CREATE UNIQUE INDEX idx_match_players_match_player ON match_players(match_id, player_id);
