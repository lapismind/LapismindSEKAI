CREATE TABLE matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT NOT NULL,
  room_id TEXT,
  rounds INTEGER NOT NULL DEFAULT 0,
  finished_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE match_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  player_id TEXT NOT NULL,
  nickname TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  is_champion INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  spells_cast TEXT,
  secrets_taken INTEGER NOT NULL DEFAULT 0,
  rounds_survived INTEGER NOT NULL DEFAULT 0,
  dragon_fails INTEGER NOT NULL DEFAULT 0,
  suicides INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  achievement_key TEXT NOT NULL,
  match_id INTEGER REFERENCES matches(id),
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(player_id, achievement_key)
);

INSERT INTO matches (game, room_id, rounds) VALUES ('abracadawhat', 'C3-OLD', 1);

INSERT INTO achievements (player_id, achievement_key, match_id, unlocked_at) VALUES
  ('p-c3', 'elemental', 1, '2026-08-01 00:00:01'),
  ('p-c3', 'comeback', 1, '2026-08-01 00:00:02'),
  ('p-c3', 'double_kill', 1, '2026-08-01 00:00:03'),
  ('p-c3', 'dragon_triple_one', 1, '2026-08-01 00:00:04'),
  ('p-c3', 'not_approved', 1, '2026-08-01 00:00:05'),
  ('p-c3', 'secret_rich', 1, '2026-08-01 00:00:06'),
  ('p-c3', 'last_breath', 1, '2026-08-01 00:00:07'),
  ('p-c3', 'spell_collector', 1, '2026-08-01 00:00:08'),
  ('p-c3', 'first_cast', 1, '2026-08-01 00:00:09');

INSERT INTO achievements (player_id, achievement_key, match_id, unlocked_at) VALUES
  ('p-existing', 'elemental', 1, '2026-08-02 00:00:01'),
  ('p-existing', 'magic_staircase', 1, '2026-08-03 00:00:01');
