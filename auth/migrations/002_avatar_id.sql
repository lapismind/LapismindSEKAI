-- 迁移 002：支持用户自选本地头像（1-26，对应 lobby-kit 头像资源）
-- avatar_id 为 NULL 时表示用默认头像（GitHub 头像 / 游客占位）

ALTER TABLE users ADD COLUMN avatar_id TEXT;
