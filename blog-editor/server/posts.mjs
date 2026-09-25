// 文章读写：只碰 blog/src/content/blog/*.md
import fs from 'node:fs/promises';
import path from 'node:path';
import { POSTS_DIR, SLUG_RE } from './paths.mjs';
import { parseFrontmatter, serializePost } from './frontmatter.mjs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 与现有文章一致的日期写法：'Sep 25 2026' */
export function today() {
	const d = new Date();
	return `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

export function assertSlug(slug) {
	if (!SLUG_RE.test(String(slug || ''))) {
		throw Object.assign(new Error('slug 只能用小写字母、数字和连字符'), { status: 400 });
	}
}

const fileOf = (slug) => path.join(POSTS_DIR, `${slug}.md`);

function summarize(slug, fields) {
	return {
		slug,
		title: fields.title || slug,
		description: fields.description || '',
		pubDate: fields.pubDate || '',
		heroImage: fields.heroImage || '',
	};
}

export async function listPosts() {
	const names = await fs.readdir(POSTS_DIR).catch(() => []);
	const posts = [];
	for (const name of names) {
		if (!name.endsWith('.md')) continue;
		const slug = name.slice(0, -3);
		const raw = await fs.readFile(path.join(POSTS_DIR, name), 'utf8');
		posts.push(summarize(slug, parseFrontmatter(raw).fields));
	}
	posts.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
	return posts;
}

export async function readPost(slug) {
	assertSlug(slug);
	const raw = await fs.readFile(fileOf(slug), 'utf8');
	const { fields, extras, body } = parseFrontmatter(raw);
	return { slug, fields, extras, body };
}

export async function savePost(slug, { fields, extras, body } = {}) {
	assertSlug(slug);
	const text = serializePost(fields, extras, body);
	await fs.writeFile(fileOf(slug), text, 'utf8');
	return { slug, bytes: Buffer.byteLength(text) };
}

export async function createPost({ slug, title, description = '', pubDate } = {}) {
	assertSlug(slug);
	try {
		await fs.access(fileOf(slug));
		throw Object.assign(new Error(`文章 ${slug}.md 已存在`), { status: 409 });
	} catch (err) {
		if (err.status) throw err;
	}
	const fields = {
		title: title || slug,
		description,
		pubDate: pubDate || today(),
		heroImage: '',
		heroImageAlt: '',
	};
	await savePost(slug, { fields, extras: [], body: '## \n' });
	return readPost(slug);
}
