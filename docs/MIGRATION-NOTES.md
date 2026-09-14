# LapismindSEKAI 迁移到新电脑说明

> 本文档随项目一起打包，供在新电脑上解压后对照处理。

## 一、迁移步骤

迁移采用「**git clone + 增量包**」方案：源代码全部在 git 仓库里，随包只带走 git clone 拿不到的文件（本地密钥、wrangler 状态、构建产物、上传资源等），压缩包最小。

1. 在新电脑上 clone 仓库到目标目录：
   ```powershell
   cd C:\Projects\Web
   git clone https://github.com/lapismind/LapismindSEKAI.git
   ```
2. 把 `LapismindSEKAI-extra.zip`（git 之外的增量文件）拷到新电脑，解压覆盖进刚 clone 的目录：
   ```powershell
   cd C:\Projects\Web\LapismindSEKAI
   tar -xf C:\path\to\LapismindSEKAI-extra.zip
   ```
   增量包里包含：各项目 `.dev.vars`/密钥、`.wrangler` 本地状态、`blog` 的 `dist` 构建产物与上传资源、`docs/MIGRATION-NOTES.md` 等。
3. 安装依赖（项目不是 npm workspace，9 个目录各自独立）：
   ```powershell
   cd C:\Projects\Web\LapismindSEKAI
   foreach ($d in @('blog','abracadawhat','showhand','turtle-soup','card-game','auth','slay-the-spire','packages\chat-kit','packages\lobby-kit')) {
     Push-Location $d; npm install; Pop-Location
   }
   ```
4. Playwright 浏览器（`blog`、`abracadawhat` 的浏览器测试需要，浏览器本体不在项目里，需单独下载）：
   ```powershell
   cd C:\Projects\Web\LapismindSEKAI\abracadawhat; npx playwright install
   cd C:\Projects\Web\LapismindSEKAI\blog; npx playwright install
   ```
5. 装完依赖后，执行以下检查确认环境可用：
   ```powershell
   cd C:\Projects\Web\LapismindSEKAI
   git status          # 应正常显示分支与改动
   git remote -v       # 应显示 github 远程地址
   ```

## 二、迁移后必须修改的硬编码路径（3 处）

旧机器上的绝对路径写死在以下脚本中，新目录下会失效。请把 `D:/LapismindSEKAI` 全部替换为 `C:/Projects/Web/LapismindSEKAI`：

| 文件 | 当前硬编码 |
|---|---|
| `blog/convert_cursor.py` | `D:/LapismindSEKAI/blog/public/cursors` |
| `blog/sekai-demo/live2d-preview/download-normal.ps1` | `D:/LapismindSEKAI/blog/sekai-demo/live2d-preview/mafuyu` |
| `blog/sekai-demo/live2d-preview/cleanup.ps1` | `D:/LapismindSEKAI/blog/sekai-demo/live2d-preview/mafuyu` |

## 三、注意事项

- **node_modules**：不在包内，新电脑上按第一节第 3 步逐个 `npm install`（`package-lock.json` 随 git 走，保证版本一致）。
- **.git / 源代码**：由 `git clone` 获取，不需要打包。迁移后可直接 `git pull` / `git push`。
- **密钥安全**：增量包里含 `.dev.vars`、`MATCH_REPORT_SECRET` 等本地密钥，文件仅限自己设备间传递，不要上传到网盘或聊天工具。
- **增量包不能覆盖 git 文件**：`git clone` 后先解压增量包，再 `npm install`，顺序不要颠倒。
- **文档中的示例路径**：`docs/*.md`、`README.md`、各游戏 `docs/` 里出现的 `D:\LapismindSEKAI` 只是文档示例命令，不影响运行，无需强制修改（有空顺手替换即可）。

## 四、验证清单

- [ ] `git status` 正常
- [ ] `git remote -v` 显示远程仓库
- [ ] 三个脚本的路径已替换
- [ ] `blog` 可本地启动（`npm run dev` 或对应脚本）
- [ ] 各联机游戏可本地起服务并进入房间
