-- 迁移 003：密码登录失败计数表（限频）
-- key = 'pw:<用户名>'；登录成功即清空该用户名记录

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_key ON login_attempts(key, created_at);
