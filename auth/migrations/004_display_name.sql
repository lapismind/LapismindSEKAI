-- 迁移 004：用户展示昵称（与登录名/账号名解耦）
-- display_name 为空时回退显示 nickname（GitHub 登录名 / 账号用户名）

ALTER TABLE users ADD COLUMN display_name TEXT;