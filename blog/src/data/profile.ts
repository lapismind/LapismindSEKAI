export const profileIdentity = {
	displayName: 'Lapismind',
	level: 'LV.1',
	role: '前端开发者 · 独立游戏作者',
	bio: '热爱把想法做成能跑起来的东西，尤其喜欢做成能玩的。这里是我的游戏世界与开发记录。',
	github: 'https://github.com/lapismind',
} as const;

export const profileStatus = [
	{ label: '正在开发', text: '出包魔法师 —— 2–5 人联机魔法对决（WebSocket + Durable Objects）。' },
	{ label: '最近在学', text: 'Astro 生态与 Cloudflare 组件的更深用法。' },
	{ label: '下一步', text: '把开发过程沉淀成更多的博客文章。' },
] as const;

export const profileTech = [
	{ key: 'vue', name: 'Vue3 / Vite', note: '游戏与前端主栈' },
	{ key: 'tailwind', name: 'Tailwind CSS', note: '界面与主题' },
	{ key: 'workers', name: 'Cloudflare Workers', note: '后端 / 部署 / 域名' },
	{ key: 'do', name: 'Durable Objects', note: '房间 / WebSocket / SQLite' },
	{ key: 'astro', name: 'Astro', note: '本站生态，学习中' },
] as const;

/** 单推角色：朝比奈真冬（资料来自官方设定） */
export const oshiCard = {
	name: '朝比奈真冬',
	nameEn: 'あさひな まふゆ / Asahina Mafuyu',
	unit: '25時、ナイトコードで。',
	role: '作詞・混音担当 · 网名「雪」/ OWN',
	birthday: '1 月 27 日',
	zodiac: '水瓶座',
	age: '17',
	height: '162cm',
	cv: '田辺留依',
	likes: '水族箱',
	skill: '英语会话',
	food: '妈妈亲手做的菜',
	/* 官方资料栏原文是「苦手なもの・こと：わからない」（pjsekai.sega.jp/character/unite05/mafuyu，
	   2026-09-22 核对；萌娘百科信息栏作「不擅长的事情：不知道」，两源一致）。
	   此前这里写的是「表达情绪」——那是对她性格的概括，不是资料栏里的值。 */
	weak: '不知道',
	tagline: '「谢谢你，找到了我。」',
	officialUrl: 'https://www.tw-pjsekai.com/mafuyu.html',
	wikiUrl: 'https://mzh.moegirl.org.cn/%E6%9C%9D%E6%AF%94%E5%A5%88%E7%9C%9F%E5%86%AC',
} as const;

/**
 * 水面之下：与卡片水面上方的「趣味／喜欢」两项呼应。
 * 来源（2026-09-22 核对）：
 *   · 趣味 —— 萌百「轶事」：「房间里有一个只放了水草和沙子的鱼缸，平常喜欢看着里面的水草摇来摇去。」
 *   · 喜欢 —— 萌百「主线」：「直到有一天她发现自己体会不到味觉，甚至不再记得爱好，情感和梦想。」
 *     （资料栏那栏写的是「妈妈亲手做的菜」）
 */
export const oshiInner = {
	items: [
		{ k: '趣味', v: '一缸水草和沙子' },
		{ k: '喜欢', v: '尝不出味道' },
	],
} as const;
