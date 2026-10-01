# task_plan — niigo-party 回合限牌修复 + 头像选目标 + 事件特写与占位语音

> 2026-09-30 开工。用户口头需求三条（攻击牌保持全向，不改）：
> 1. 每回合只能用一张牌没有正确生效；
> 2. 指定目标应该用头像做选项，现在的文字按钮太丑；
> 3. 抢钱之类的定向效果，任何角色遭遇事件都要给一定时间特写，带角色语音
>    （真声缺省，先用合成电子音替代，好事/坏事两大类）。

## 结论先行（定位）

- **限牌漏洞**：`engine.js playEffectCard` 只对 `kind === 'effect'` 判 `effectPlayed`，
  反制牌（shield/mirror）kind 是 `counter`，绕过限制 → 一回合能连出反制+效果牌。
  另外 battle 牌走 `playEffectCard` 会被静默消耗（无效果），补 guard。
- **选目标**：GameScreen.vue 的对手指向是纯文字按钮条；chibi 头像裁剪参数
  PlayerCard.vue 已有（1024² 基底，width 244% / left -69% / top -12%）。
- **事件特写**：popup 体系已有 `tone: good|bad|info` + `playerId`，但定向效果
  （snatch/band/brick、陷阱触发）只写 log 不弹窗；EventPopup 无角色特写、无语音。

## 步骤

- [x] 1. 引擎限牌：`playEffectCard` 的 `effectPlayed` 判定与置位对 effect/counter 统一；
       battle 牌直接 return。
- [x] 2. 引擎补弹窗：band/brick/snatch（受害者 bad + 施放者 good，反弹时角色随
       apply 换位自动对调）、shield/reflect 触发、moveStep 里 bomb/phish/roadblock
       触发（受害者 + 主人）；tiles.js 横财/横财高收益补 good 弹窗。
       顺带修正：以牙还牙反弹 KO 时抢币对象应为反弹者（原实现还是原施放者）。
- [x] 3. `src/game/voices.js`：每角色 好事/坏事 占位台词池（中文短句）+ 音高/语速
       分角色配置；`pickVoiceLine` / `speakLine`（Web Speech API，zh-CN）/ `cancelSpeech`。
       真声素材就位后换数据即可。
- [x] 4. store：consumeFx 时给弹窗补 `charKey` + `line`；armPopup 常态档朗读
       （快速档不读，保节奏）、特写停留 = max(pace.popup, 台词长度保底)；换条时 cancelSpeech。
- [x] 5. EventPopup 重做：大头像（角色色描边）+ 台词气泡 + 事件标题/正文 + 缩小的插画占位位。
- [x] 6. TargetPicker.vue：头像大按钮（名字/格号/币/HP），GameScreen 替换文字按钮条。
- [x] 7. GameScreen：cardPlayable 挡 counter（effectPlayed 统一）、手牌提示文案改「可出 1 张牌」。
- [x] 8. 单测：counter+effect 合计限 1 张；battle 牌掷骰前打不出；定向效果弹窗断言
       （含反弹换位）；横财弹窗。整局随机模拟的出牌过滤同步改。全量跑。
- [x] 9. `npm run build` + 两套 Playwright 冒烟（battle / board-editor）。
- [x] 10. docs：进度.md 增「回合限牌 / 选目标 / 事件特写」小节；lessons-learned 记
        「类型拆分后统一约束漏了 counter」；CURRENT.md 收尾改状态。

## 边界与注意

- 不提交素材产物；不部署；完成后不擅自 commit（等用户确认）。
- 引擎保持纯逻辑：voices.js 只被 store / EventPopup 引用，不进 engine。
- popup 数量增加会拉长结算停留（settleIfIdle 等弹窗播完），快速档全部缩短，属预期。
