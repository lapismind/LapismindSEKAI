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

INSERT INTO matches (game, room_id, rounds) VALUES ('abracadawhat', 'CAREER-V1', 1);
INSERT INTO matches (game, room_id, rounds) VALUES ('abracadawhat', 'CAREER-V1-NULL', 1);
INSERT INTO match_players
  (match_id, player_id, nickname, is_champion, kills, deaths, spells_cast, suicides)
VALUES
  (1, 'p-career', '旧版', 1, 2, 1, '{"1":2,"2":1}', 1),
  (2, 'p-career', '旧版空值', 0, 0, 0, NULL, 0);
