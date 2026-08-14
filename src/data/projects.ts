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

export const projects: Project[] = [
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
		slug: 'card-game',
		name: 'Card Game',
		subtitle: '联机卡牌对战（开发中）',
		description:
			'基于 Vue3 与 Cloudflare Workers 的联机卡牌对战游戏，复用海龟汤的 WebSocket + Durable Objects 架构。',
		status: 'developing',
		tech: ['Vue3', 'Pinia', 'Vite', 'Tailwind', 'Cloudflare Workers'],
		links: {},
	},
];
