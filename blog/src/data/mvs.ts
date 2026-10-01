import type { ImageMetadata } from 'astro';
import kyomuSanCover from '../assets/mv/kyomu-san.jpg';

export interface Mv {
	slug: string;
	/** 曲名（站内展示名） */
	name: string;
	/** 副标题：原曲出处 / 出场角色 / 风格 */
	subtitle: string;
	description: string;
	/** B 站视频页链接（MV 的正片住在站外，站内只做引流） */
	url: string;
	/** 发布日期（ISO，YYYY-MM-DD） */
	date: string;
	/** 正片时长（秒） */
	duration: number;
	/** 制作标签（斜线小字用） */
	tech: string[];
	/** 封面（16:9，站内自托管——B 站图床有 Referer 防盗链，不能热链） */
	cover: ImageMetadata;
	/** 是否进首页「SEKAI 精选」——与游戏 / Projects 共用同一枚标记 */
	featured?: boolean;
}

/** 自制 MV（AI 生成 2D MV，正片发布在 B 站 @清明葬花祭）。
 *  新增一支 MV：封面图放进 src/assets/mv/，在下面追加一条即可。 */
export const mvs: Mv[] = [
	{
		slug: 'kyomu-san',
		name: '虚无小姐',
		subtitle: '虚無さん / 25時、ナイトコードで。 × 鏡音レン — 朝比奈まふゆ Fan-made 2DMV',
		description:
			'第一支自制 2D MV，铅格风。分镜、动效与全部代码由 Claude Opus 5.5 执刀，作画 NoobAI-XL。非官方 Fan-made 作品，与官方无关。',
		url: 'https://www.bilibili.com/video/BV1AoYc6fE3m',
		date: '2026-10-01',
		duration: 95,
		tech: ['2DMV', '铅格风', 'Claude Opus 5.5', 'NoobAI-XL'],
		cover: kyomuSanCover,
		featured: true,
	},
];
