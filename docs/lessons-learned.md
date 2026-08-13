# turtle-soup 错误记忆

> 供本项目复用。跨项目通用教训同步到 D:\tianxunruida\docs\通用错误记忆库.md。

## 2026-08-14

### 1. PowerShell 批量替换文件导致中文乱码（重大教训）
- 现象：用 PowerShell 脚本批量 `Set-Content` 替换 9 个 vue 文件里的 `violet-` → `brand-`，所有中文全部乱码。
- 根因：PowerShell 5.1 的 `Get-Content` 默认按 ANSI(GBK) 读取 UTF-8 文件，把 UTF-8 字节误当成 GBK 解析成乱码字符，再 `Set-Content -Encoding UTF8` 写回 → 双重编码损坏。
- 修复：UTF-8 解码 mojibake 字符串 → GBK 编码还原原始字节 → 再写回 UTF-8 无 BOM，恢复约 90%；残余损坏逐个用 Edit 修补。
- 教训（铁律）：
  1. **任何项目第一时间 `git init`**，改文件前先提交基线，坏了一键回滚（本次能救纯属运气）。
  2. **批量改文件不用 PowerShell 写文件**，优先用 Node 脚本（`readFileSync`/`writeFileSync` 指定 utf8）或编辑器。
  3. 必须用 PowerShell 时：`Get-Content -Raw -Encoding UTF8` 读，`[System.IO.File]::WriteAllText($p, $c, [System.Text.Encoding]::UTF8)` 写，禁止裸 `Set-Content`。
  4. 改完立即 `npm run build` 验证（编译能抓出断引号等结构错误）。

### 2. 编码验证要读字节，不要看终端
- PowerShell 控制台输出中文乱码是显示编码问题（GBK 控制台 vs UTF-8 内容），不代表文件损坏。
- 验证文件是否真的损坏：用 Node `readFileSync(path,'utf8')` 读字节判断，别信终端回显。

### 3. HTML 属性引号丢失是构建错误主因
- 恢复损坏时 `placeholder="xxx…` 末尾引号可能丢失，Vue 编译报 `Attribute name cannot contain U+0022`。
- 修复后必须跑 `npm run build`，不能只靠视觉扫描。

## 未解决

### AI 复盘按钮始终不显示（房主视角）
- 见 `docs/todos.md`。
