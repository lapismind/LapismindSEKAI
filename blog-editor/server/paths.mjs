// 路径真源：blog-editor 只认这些常量，别在别处再拼一遍。
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const EDITOR_ROOT = path.resolve(here, '..');
export const REPO_ROOT = path.resolve(EDITOR_ROOT, '..');
export const BLOG_ROOT = path.join(REPO_ROOT, 'blog');

export const POSTS_DIR = path.join(BLOG_ROOT, 'src', 'content', 'blog');
export const ASSETS_DIR = path.join(BLOG_ROOT, 'src', 'assets');
export const POST_ASSETS_DIR = path.join(ASSETS_DIR, 'posts');
export const COVER_ASSETS_DIR = path.join(ASSETS_DIR, 'covers');

// 文章文件在 blog/src/content/blog/，图片在 blog/src/assets/ 下，所以是两级向上。
export const POST_ASSET_PREFIX = '../../assets/posts';
export const COVER_ASSET_PREFIX = '../../assets/covers';

export const PORT = Number(process.env.PORT || 5180);

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/** 只允许 ascii 字母数字，其余折叠成连字符；用于图片文件名。 */
export function safeAssetName(name) {
	const base = String(name || 'image')
		.replace(/\.[^.]+$/, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	const ext = (String(name || '').match(/\.([a-z0-9]+)$/i)?.[1] || 'png').toLowerCase();
	return `${base || 'image'}.${ext}`;
}
