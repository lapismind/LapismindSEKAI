export interface Project {
	slug: string;
	name: string;
	subtitle: string;
	description: string;
	status: 'online' | 'developing';
	tech: string[];
	links: {
		online?: string;
		github?: string;
	};
	featured?: boolean;
}

/** 个人游戏作品（二次元玩家概念） */
export const games: Project[] = [
	{
		slug: 'turtle-soup',
		name: '真冬的海龟汤',
		subtitle: '回合制联机海龟汤推理游戏',
		description:
			'玩家根据"汤面"向主持人提问，主持人回答是/否/是也不是/无关，推理出"汤底"即胜出。AI 主持与真人主持双模式，支持 2-8 人、观战与复盘。',
		status: 'online',
		tech: ['Vue3', 'Vite', 'Tailwind', 'Cloudflare Workers', 'Durable Objects', 'WebSocket'],
		links: {
			online: 'https://soup.qmzhj.top',
			github: 'https://github.com/lapismind/Mafuyu-Turtle-soup',
		},
		featured: true,
	},
	{
		slug: 'abracadawhat',
		name: '出包魔法师',
		subtitle: '2–5 人联机魔法对决，施法、抢先生到 8 分',
		description:
			'每人 5 张暗手牌、6 点生命值。你能看到别人的牌但看不到自己的，轮到你时喊出魔法名施法——攻击、回复、侦察各有妙用。率先拿到 8 分即胜出。服务端持全部暗牌做唯一仲裁，杜绝作弊。',
		status: 'online',
		tech: ['Vue3', 'Pinia', 'Vite', 'Tailwind', 'lobby-kit', 'Cloudflare Workers', 'Durable Objects'],
		links: {
			online: 'https://abracadawhat.qmzhj.top',
		},
		featured: true,
	},
	{
		slug: 'showhand',
		name: '梭哈 Showhand',
		subtitle: '五张/七张牌联机梭哈，复用 lobby-kit 大厅层',
		description:
			'支持五张与七张两种玩法的联机梭哈：发牌节奏、下注轮转、All-in 补牌摊牌、平分底池余数处理，带上帝视角观众席。大厅部分复用 @lapismind/lobby-kit，只写游戏逻辑本身。',
		status: 'online',
		tech: ['Vue3', 'Pinia', 'Vite', 'Tailwind', 'lobby-kit', 'Cloudflare Workers', 'Durable Objects'],
		links: {
			online: 'https://showhand.qmzhj.top',
			github: 'https://github.com/lapismind/showhand',
		},
		featured: true,
	},
];

