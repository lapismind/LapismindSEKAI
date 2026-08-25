-- 用户表：GitHub 登录用户；游客不落库
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL DEFAULT 'github',
  github_id TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 博客/游戏页评论
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  page_path TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_page ON comments(page_path, created_at DESC);

-- 对局记录（一场 = 一次 game_over，含多轮）
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT NOT NULL,                    -- 'abracadawhat' / 'turtle-soup' / ...
  room_id TEXT,                          -- DO 房间号（可空，调试用）
  rounds INTEGER NOT NULL DEFAULT 0,     -- 总轮数
  finished_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 对局中的玩家战绩（按 playerId 记，游客和 GitHub 用户都存）
CREATE TABLE IF NOT EXISTS match_players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  player_id TEXT NOT NULL,               -- lobby-kit playerId（游客 pu 前缀区分）
  nickname TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  is_champion INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,      -- 累计击杀数
  deaths INTEGER NOT NULL DEFAULT 0,     -- 死亡次数
  spells_cast TEXT,                      -- JSON: { "1": 2, "4": 1 } 各魔法成功次数
  secrets_taken INTEGER NOT NULL DEFAULT 0,
  rounds_survived INTEGER NOT NULL DEFAULT 0,
  dragon_fails INTEGER NOT NULL DEFAULT 0,   -- 古代巨龙施法失败次数
  suicides INTEGER NOT NULL DEFAULT 0        -- 施法失败自杀次数
);

CREATE INDEX IF NOT EXISTS idx_match_players_pid ON match_players(player_id);
CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);

-- 成就达成记录（跨场次唯一：同一玩家同一成就只记一次）
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  achievement_key TEXT NOT NULL,         -- 成就英文 key，如 'dragon_triple_kill'
  match_id INTEGER REFERENCES matches(id),
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(player_id, achievement_key)
);

CREATE INDEX IF NOT EXISTS idx_achievements_pid ON achievements(player_id);
