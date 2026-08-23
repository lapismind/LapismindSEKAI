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
		slug: 'card-game',
		name: 'Card Game',
		subtitle: '联机卡牌对战（开发中）',
		description:
			'基于 Vue3 与 Cloudflare Workers 的联机卡牌对战游戏，复用海龟汤的 WebSocket + Durable Objects 架构。',
		status: 'developing',
		tech: ['Vue3', 'Pinia', 'Vite', 'Tailwind', 'Cloudflare Workers'],
		links: {},
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

/** 企业/工作中项目（AI 学习平台栏目） */
export const workProjects: Project[] = [
	{
		slug: 'aiforum',
		name: '公诚咨询AI赋能学习平台',
		subtitle: 'AI 赋能传统业务的内部学习平台',
		description:
			'以 AI 技术赋能招标、监理等传统业务部门的学习平台，包含新手教程、实战任务、进阶知识科普，教员工使用星辰超级智能体、理解 Skill 与 AI 概念。',
		status: 'online',
		tech: ['HTML', 'CSS', 'JavaScript', 'Cloudflare Workers', 'Markdown'],
		links: {
			online: 'https://aiforum.qmzhj.top',
		},
	},
];
