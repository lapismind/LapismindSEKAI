-- 迁移 001：支持用户名密码账号（方案一）
-- 1) users 表重建：github_id 放宽为可空、新增 password_hash
-- 2) 同名账号唯一索引（仅对 provider='account' 生效）
-- 3) 数据完整搬迁，comments 等外键引用的 id 不变

ALTER TABLE users RENAME TO users_legacy;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL DEFAULT 'github',
  github_id TEXT UNIQUE,
  password_hash TEXT,
  player_id TEXT UNIQUE,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users (id, provider, github_id, password_hash, player_id, nickname, avatar_url, created_at)
SELECT id, provider, github_id, NULL, NULL, nickname, avatar_url, created_at FROM users_legacy;

DROP TABLE users_legacy;

CREATE UNIQUE INDEX idx_users_account_name ON users(nickname) WHERE provider = 'account';

-- SQLite 外键按表「名字」绑定：users 改过名，comments 的外键仍指向 users_legacy。
-- 重建 comments 表让外键重新指回 users。
CREATE TABLE comments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  page_path TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO comments_new (id, user_id, page_path, content, created_at)
SELECT id, user_id, page_path, content, created_at FROM comments;
DROP TABLE comments;
ALTER TABLE comments_new RENAME TO comments;

-- 同理重建受影响的索引（DROP TABLE 会连带删索引）
CREATE INDEX IF NOT EXISTS idx_comments_page ON comments(page_path, created_at DESC);
