/**
 * 功能开关。
 *
 * 用常量而不是把判断散在组件里，是为了让"以后要开"是一行改动，
 * 也为了让"哪里受这个开关影响"能被 grep 到。
 *
 * AI 主持 / AI 复盘：2026-09-16 关闭。理由（用户决定）：
 *   - token 成本还太高；
 *   - AI 判定提问的准确率不够；
 *   - 玩家更愿意和真人朋友一起玩。
 * 实现与协议字段（`mode: 'ai' | 'human'`）全部保留，重新开放时
 * 把这里和 `src/worker/soupRoom.js` 的 `AI_MODE_ENABLED` 一起改回 true 即可。
 * 背景见 .planning/2026-09-16-turtle-soup-vote-apples/
 */
export const AI_MODE_ENABLED = false
