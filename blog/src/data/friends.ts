export interface FriendLink {
	/** 展示名 */
	name: string;
	/** 一句话定位 */
	subtitle: string;
	/** 介绍（两三句，写在友链卡正文里） */
	description: string;
	/** 链接（项目主页 / GitHub） */
	url: string;
	/** 作者 / 维护者 */
	owner: string;
	/** 技术小字 */
	tech: string[];
	/** 开源协议（可选，缺省不显示协议行） */
	license?: string;
}

/** 友链：我自己在用、觉得值得推荐的项目与站点。新友链在这里追加一条。 */
export const friends: FriendLink[] = [
	{
		name: 'SekaiSync',
		subtitle: '面向 Project SEKAI 粉丝的本地知识库 + MCP AI 上下文服务',
		description:
			'把官方 Master Data、日/英/简中/繁中/韩五区术语对照和社区剧情文本同步到本地，通过 MCP（stdio / Streamable HTTP）或 CLI 喂给 Claude、Cursor 这类 AI Agent——查得到的给有据可查的真实数据，查不到就如实说「未收录」，从源头掐掉幻觉。纯 Python 标准库实现，零第三方依赖。',
		url: 'https://github.com/omoinoki/sekaisync',
		owner: 'omoinoki',
		tech: ['Python', 'MCP', '知识库'],
		license: 'MIT',
	},
];
