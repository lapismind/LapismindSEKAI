-- Migration 007: Per-player recent match reports for persistent accounts.

CREATE TABLE IF NOT EXISTS player_match_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  player_id TEXT NOT NULL,
  game TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  rounds INTEGER NOT NULL,
  player_count INTEGER NOT NULL,
  standings_json TEXT NOT NULL,
  stories_json TEXT NOT NULL,
  unlocked_keys_json TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  UNIQUE(match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_match_reports_recent
  ON player_match_reports(player_id, game, finished_at DESC, id DESC);
