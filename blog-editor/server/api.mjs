// API 路由 + 博客素材静态托管。没有框架，保持依赖最少。
import fs from 'node:fs/promises';
import path from 'node:path';
import { ASSETS_DIR } from './paths.mjs';
import { listPosts, readPost, savePost, createPost } from './posts.mjs';
import { saveAsset } from './assets.mjs';
import { publish } from './publish.mjs';

const MIME = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.avif': 'image/avif',
};

function json(res, code, data) {
	const body = JSON.stringify(data);
	res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
	res.end(body);
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		req.on('data', (c) => chunks.push(c));
		req.on('end', () => resolve(Buffer.concat(chunks)));
		req.on('error', reject);
	});
}

async function readJson(req) {
	const buf = await readBody(req);
	if (!buf.length) return {};
	return JSON.parse(buf.toString('utf8'));
}

/** 把 blog/src/assets 挂在 /blog-assets，预览里的相对路径改写到这个前缀。 */
async function serveAsset(url, res) {
	const rel = decodeURIComponent(url.pathname.replace(/^\/blog-assets\/?/, ''));
	const abs = path.resolve(ASSETS_DIR, rel);
	if (!abs.startsWith(ASSETS_DIR)) {
		res.writeHead(403);
		return res.end('forbidden');
	}
	try {
		const data = await fs.readFile(abs);
		res.writeHead(200, {
			'content-type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream',
			'cache-control': 'no-store',
		});
		res.end(data);
	} catch {
		res.writeHead(404);
		res.end('not found');
	}
}

function servePublishSSE(req, res, slug) {
	res.writeHead(200, {
		'content-type': 'text/event-stream; charset=utf-8',
		'cache-control': 'no-cache',
		connection: 'keep-alive',
	});
	const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

	readPost(slug)
		.then((post) => publish({ fields: post.fields, onEvent: send }))
		.catch((err) => send({ type: 'error', message: err.message, errors: [] }))
		.finally(() => res.end());
}

export async function handleApi(req, res) {
	const url = new URL(req.url, 'http://localhost');
	const { pathname } = url;
	const method = req.method || 'GET';

	try {
		if (method === 'GET' && pathname === '/api/posts') {
			return json(res, 200, { posts: await listPosts() });
		}

		if (method === 'POST' && pathname === '/api/posts') {
			const body = await readJson(req);
			const post = await createPost(body);
			return json(res, 201, { post });
		}

		const postMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
		if (postMatch) {
			const slug = decodeURIComponent(postMatch[1]);
			if (method === 'GET') return json(res, 200, { post: await readPost(slug) });
			if (method === 'PUT') {
				const body = await readJson(req);
				await savePost(slug, body);
				return json(res, 200, { ok: true });
			}
		}

		if (method === 'POST' && pathname === '/api/assets') {
			const kind = url.searchParams.get('kind') === 'cover' ? 'cover' : 'post';
			const name = url.searchParams.get('name') || 'image.png';
			const data = await readBody(req);
			if (!data.length) return json(res, 400, { error: '空文件' });
			return json(res, 200, await saveAsset({ kind, name, data }));
		}

		if (method === 'GET' && pathname === '/api/publish') {
			const slug = url.searchParams.get('slug') || '';
			return servePublishSSE(req, res, slug);
		}

		json(res, 404, { error: `没有这个接口：${method} ${pathname}` });
	} catch (err) {
		json(res, err.status || 500, { error: err.message || '服务器内部错误' });
	}
}

export async function handleStatic(req, res, next) {
	const url = new URL(req.url, 'http://localhost');
	if (url.pathname.startsWith('/blog-assets/')) return serveAsset(url, res);
	next();
}
