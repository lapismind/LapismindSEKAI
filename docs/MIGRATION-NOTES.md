# LapismindSEKAI 迁移到新电脑说明

> 本文档随项目一起打包，供在新电脑上解压后对照处理。
>
> **路径约定**：不同设备把仓库放在不同目录（例如一台 `D:\LapismindSEKAI`，另一台 `C:\Projects\Web\LapismindSEKAI`）。
> 因此本仓库内的脚本与文档**一律用相对路径**，不写死盘符。下文用 `<仓库>` 表示你 clone 出来的仓库根目录。

## 一、迁移步骤

迁移采用「**git clone + 增量包**」方案：源代码全部在 git 仓库里，随包只带走 git clone 拿不到的文件（本地密钥、wrangler 状态、构建产物、上传资源等），压缩包最小。

1. 在新电脑上把仓库 clone 到**任意目录**（代码不依赖具体路径，放哪都行）：
   ```powershell
   cd <存放项目的目录>
   git clone https://github.com/lapismind/LapismindSEKAI.git
   cd LapismindSEKAI
   ```
2. 把 `LapismindSEKAI-extra.zip`（git 之外的增量文件）拷到新电脑，解压覆盖进刚 clone 的目录：
   ```powershell
   tar -xf <增量包所在路径>\LapismindSEKAI-extra.zip
   ```
   增量包里包含：各项目 `.dev.vars`/密钥、`.wrangler` 本地状态、`blog` 的 `dist` 构建产物与上传资源等。
3. 安装依赖（项目不是 npm workspace，9 个目录各自独立；在**仓库根目录**执行）：
   ```powershell
   foreach ($d in @('blog','abracadawhat','showhand','turtle-soup','card-game','auth','slay-the-spire','packages\chat-kit','packages\lobby-kit')) {
     Push-Location $d; npm install; Pop-Location
   }
   ```
4. Playwright 浏览器（`blog`、`abracadawhat` 的浏览器测试需要，浏览器本体不在项目里，需单独下载；同样在仓库根目录执行）：
   ```powershell
   Push-Location blog; npx playwright install; Pop-Location
   Push-Location abracadawhat; npx playwright install; Pop-Location
   ```
5. 装完依赖后，执行以下检查确认环境可用：
   ```powershell
   git status          # 应正常显示分支与改动
   git remote -v       # 应显示 github 远程地址
   ```

## 二、路径约定：换机器不需要改任何路径

早期版本有三个脚本写死了旧机器的绝对路径，换目录就会失效。**现已改为按脚本自身位置解析**，换机器、换目录都无需修改：

| 文件 | 现在的写法 |
|---|---|
| `blog/convert_cursor.py` | `os.path.dirname(os.path.abspath(__file__))` 拼出 `public/cursors` |
| `blog/sekai-demo/live2d-preview/download-normal.ps1` | `Join-Path $PSScriptRoot "mafuyu"` |
| `blog/sekai-demo/live2d-preview/cleanup.ps1` | `Join-Path $PSScriptRoot "mafuyu"` |

**新增脚本请沿用同一约定**，不要写 `D:\...` / `C:\...`：

- PowerShell：用 `$PSScriptRoot` 定位脚本所在目录
- Python：用 `os.path.dirname(os.path.abspath(__file__))` 或 `pathlib.Path(__file__).parent`
- 文档里的命令：写成"在仓库根目录执行 `cd blog`"，或直接用仓库内相对路径 `blog/`，不要带盘符
- 用户目录下的个人路径（凭证、缓存等）：用环境变量（`%APPDATA%`、`$HOME`）而不是写死用户名

## 三、注意事项

- **node_modules**：不在包内，新电脑上按第一节第 3 步逐个 `npm install`（`package-lock.json` 随 git 走，保证版本一致）。
- **.git / 源代码**：由 `git clone` 获取，不需要打包。迁移后可直接 `git pull` / `git push`。
- **密钥安全**：增量包里含 `.dev.vars`、`MATCH_REPORT_SECRET` 等本地密钥，文件仅限自己设备间传递，不要上传到网盘或聊天工具。
- **增量包不能覆盖 git 文件**：`git clone` 后先解压增量包，再 `npm install`，顺序不要颠倒。
- **仓库位置随意**：代码与文档都不依赖仓库所在目录，两台设备用不同路径是正常的——**不要**把文档里的示例路径"统一"成自己那台机器的绝对路径。

## 四、验证清单

- [ ] `git status` 正常
- [ ] `git remote -v` 显示远程仓库
- [ ] 仓库内搜不到写死的盘符路径：`git grep -nIE '(^|[^A-Za-z0-9])[A-Za-z]:[\\/]'`
      （预期只剩占位示例与历史记录：`docs/lessons-learned.md`、`scripts/sync.ps1` 的注释，以及 `.planning/` 下逐字保留的过往日志）
- [ ] `blog` 可本地启动（`npm run dev` 或对应脚本）
- [ ] 各联机游戏可本地起服务并进入房间
