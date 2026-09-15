# scripts/sync.ps1 —— 跨设备接力的同步命令
#
# 为什么需要它：跨设备开发唯一真实的失败模式是「忘」——忘 push，或留着未提交的
# 改动就换机器（后者会让另一台 pull 时冲突）。把动作收成两条命令就不容易漏。
#
# 用法（在仓库根目录）：
#   .\scripts\sync.ps1 status                     看两台机器的分叉情况
#   .\scripts\sync.ps1 pull                       开工：拉取到最新
#   .\scripts\sync.ps1 ship -m "说明这次做了什么"   收工：提交 + 推送
#
# 流程与约定见 docs/agent/handoff.md。

[CmdletBinding()]
param(
	[Parameter(Position = 0)]
	[ValidateSet('status', 'pull', 'ship')]
	[string]$Action = 'status',

	# ship 时必填：写清"这次做到哪、下次从哪继续"
	[string]$Message,

	[switch]$Help
)

$ErrorActionPreference = 'Stop'

function Fail($msg) {
	Write-Host "× $msg" -ForegroundColor Red
	exit 1
}

function Info($msg) {
	Write-Host "· $msg" -ForegroundColor Cyan
}

function Ok($msg) {
	Write-Host "✓ $msg" -ForegroundColor Green
}

# 必须从仓库根运行，否则相对路径（docs/session-logs 等）会指错地方。
# 注意：Windows 上 git 返回正斜杠（C:/x/y）、Get-Location 返回反斜杠（C:\x\y），
# 必须先归一化再比，否则在根目录也会被拦下。
$root = (git rev-parse --show-toplevel 2>$null)
if (-not $root) { Fail '当前目录不在 git 仓库里' }
$root = $root.Trim()
$norm = { param($p) $p.Replace('\', '/').TrimEnd('/') }
if ((& $norm (Get-Location).Path) -ne (& $norm $root)) {
	Fail "请在仓库根目录运行：cd `"$root`""
}

if ($Help) {
	Get-Help $PSCommandPath -Detailed
	exit 0
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()

switch ($Action) {
	'status' {
		Info "分支：$branch"
		git fetch --quiet origin
		if ($LASTEXITCODE -ne 0) { Write-Host '  ! fetch 失败（断网？），下面的比较基于本地已有的远程记录' -ForegroundColor Yellow }
		$ahead = (git rev-list --count "origin/$branch..HEAD").Trim()
		$behind = (git rev-list --count "HEAD..origin/$branch").Trim()
		if ($ahead -eq '0' -and $behind -eq '0') {
			Ok '本地与远程一致'
		} else {
			Write-Host "  未推送 $ahead 个提交，落后 $behind 个提交" -ForegroundColor Yellow
			if ($ahead -ne '0') { git log --oneline "origin/$branch..HEAD" | ForEach-Object { "    待推: $_" } }
			if ($behind -ne '0') { git log --oneline "HEAD..origin/$branch" | ForEach-Object { "    待拉: $_" } }
		}
		$dirty = git status --porcelain
		if ($dirty) {
			Write-Host "  工作区有未提交改动：" -ForegroundColor Yellow
			$dirty | ForEach-Object { "    $_" }
			if ($behind -ne '0') {
				Write-Host '  ! 有未提交改动又落后远程：直接 pull 可能冲突，先 ship 或先处理这些改动' -ForegroundColor Red
			} else {
				Write-Host '  ! 别忘了收工前 ship' -ForegroundColor Yellow
			}
		} else {
			Ok '工作区干净'
		}
	}

	'pull' {
		$dirty = git status --porcelain
		if ($dirty) {
			Fail '工作区有未提交改动。先 ship（提交+推送）或自行处理，再 pull——避免把换机器前的工作搞丢'
		}
		Info '拉取中（rebase，保持单线历史）…'
		git pull --rebase origin $branch
		if ($LASTEXITCODE -ne 0) { Fail 'pull 失败（可能是冲突）。处理冲突后 git rebase --continue' }
		Ok '已是最新'
		Write-Host '  下一步：让 Agent 读 docs/session-logs/CURRENT.md 接手上一段工作' -ForegroundColor Cyan
	}

	'ship' {
		if (-not $Message) { Fail 'ship 需要 -m 说明这次做到哪、下次从哪继续' }

		$dirty = git status --porcelain
		if ($dirty) {
			$n = ($dirty | Measure-Object).Count
			Info "提交 $n 项改动…"
			git add -A
			git commit -m $Message | Out-Null
			if ($LASTEXITCODE -ne 0) { Fail 'git commit 失败' }
			Ok "已提交：$Message"
		} else {
			Info '工作区干净，无需提交'
		}

		# 两台机器可能各自提交了不同改动。先 rebase 到远程最新再推，
		# 让历史自动保持单线；只有内容真冲突时才需要人工介入。
		git fetch --quiet origin
		$behind = (git rev-list --count "HEAD..origin/$branch").Trim()
		if ($behind -ne '0') {
			Info "远程领先 $behind 个提交，先 rebase…"
			git pull --rebase origin $branch
			if ($LASTEXITCODE -ne 0) {
				Fail "rebase 冲突。处理冲突后 `git add` + `git rebase --continue`，再重新 ship"
			}
			Ok '已 rebase 到远程最新'
		}

		$ahead = (git rev-list --count "origin/$branch..HEAD").Trim()
		if ($ahead -eq '0') {
			Ok '远程已是最新，没有需要推送的东西'
			exit 0
		}

		Info "推送 $ahead 个提交…"
		git push origin $branch
		if ($LASTEXITCODE -ne 0) { Fail 'push 失败。检查网络或权限后重试' }
		Ok '已推送，可以换机器了'
	}
}
