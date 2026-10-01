/**
 * src/game/voices.js —— 角色占位语音（好事 / 坏事两大类）
 *
 * 真声素材缺省：先用浏览器 Web Speech API 合成电子音替代（zh-CN，分角色调音高/语速）。
 * 素材就位后只需替换数据：台词换成 { audio: '路径', text: '...' }，
 * speakLine 改为播 <audio>，展示层（EventPopup 的台词气泡）不用动。
 *
 * 本文件不进引擎（engine 保持纯逻辑），只被 store / EventPopup 引用。
 * 台词为占位创作，非原作语音文本；mfy 双形态共用一套（mfy_yuki / mfy_own → mfy）。
 */

export const VOICE_LINES = {
  ena: {
    good: ['哼，看吧，我的运气不差。', '这种好事，发生在我身上很正常吧。', '嘿嘿，感觉不错嘛。'],
    bad:  ['等等，为什么是我啊！', '住手啊，烦死了！', '呜……今天真是倒霉。'],
  },
  mfy: {
    good: ['太好了呢。', '嘿嘿，今天运气不错哦。', '谢谢，帮大忙了。'],
    bad:  ['呜……好过分。', '怎么会这样……', '好疼……要哭了哦。'],
  },
  knd: {
    good: ['嗯……感觉，不坏。', '谢谢。……灵感好像来了。', '哦，不错呢。'],
    bad:  ['……好疼。', '为什么……是我。', '想回被窝……'],
  },
  mzk: {
    good: ['嘿嘿，大丰收～', '运气也是实力哦！', '哦哦，赚到了！'],
    bad:  ['呜哇！搞什么啊！', '太倒霉了吧喂！', '呜……我的星币……'],
  },
};

/** 双形态映射与角色合成音参数（pitch / rate 微调出区分度，电子音占位用） */
export const VOICE_OF = { mfy_yuki: 'mfy', mfy_own: 'mfy' };

export const VOICE_CFG = {
  ena: { pitch: 1.15, rate: 1.05 },
  mfy: { pitch: 1.0, rate: 0.95 },
  knd: { pitch: 0.8, rate: 0.85 },
  mzk: { pitch: 1.3, rate: 1.1 },
};

const baseOf = (charKey) => VOICE_OF[charKey] ?? charKey;

/** 按事件调性挑一条台词：bad → 坏事池，其余（good/info）→ 好事池。没有台词返回 null */
export function pickVoiceLine(charKey, tone) {
  const pool = VOICE_LINES[baseOf(charKey)]?.[tone === 'bad' ? 'bad' : 'good'];
  if (!pool?.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** 合成电子音朗读（占位）。返回 utterance 便于上层跟踪；环境不支持时返回 null */
export function speakLine(charKey, text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return null;
  try {
    window.speechSynthesis.cancel(); // 上一条还没读完就换人，直接掐掉
    const u = new SpeechSynthesisUtterance(text);
    const cfg = VOICE_CFG[baseOf(charKey)] ?? {};
    u.lang = 'zh-CN';
    u.pitch = cfg.pitch ?? 1;
    u.rate = cfg.rate ?? 1;
    u.volume = 0.9;
    window.speechSynthesis.speak(u);
    return u;
  } catch {
    return null; // 合成语音失败只降级为无声，不影响对局
  }
}

export function cancelSpeech() {
  try { window?.speechSynthesis?.cancel(); } catch { /* 忽略 */ }
}
