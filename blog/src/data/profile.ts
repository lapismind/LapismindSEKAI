export const profileIdentity = {
	displayName: 'Lapismind',
	level: 'LV.1',
	role: '音游玩家 · 真冬单推',
	bio: '马六 T84。最近在试着入坑《以撒》和《战地6》。',
	github: 'https://github.com/lapismind',
} as const;

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
