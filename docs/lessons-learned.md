# showhand 错误记忆

> 供本项目复用。跨项目通用教训同步到 D:\tianxunruida\docs\通用错误记忆库.md。

## 2026-08-14

### 1. 首次提交误提交 node_modules（2763 个文件）
- 现象：`git add -A` 后 node_modules 全被提交（2763 个文件），commit 刷屏警告。
- 根因：showhand 还没建 .gitignore（Task 1 脚手架步骤被跳过），`npm install` 装完依赖后直接 commit。
- 修复：写 .gitignore（node_modules/dist/.wrangler/.dev.vars），`git rm -r --cached node_modules` 移除，重新 commit。
- 教训：**任何新项目 npm install 之前先建 .gitignore**；commit 前 `git status` 检查有没有 node_modules 混入。

## 未解决

（无）
