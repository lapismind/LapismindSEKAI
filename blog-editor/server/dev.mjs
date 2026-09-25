// 单进程：同一个端口上跑 API + 博客素材 + Vite（middleware 模式）。
// 这样只需要 `npm run dev` 一条命令、一个端口。
import http from 'node:http';
import { createServer as createViteServer } from 'vite';
import { handleApi, handleStatic } from './api.mjs';
import { PORT } from './paths.mjs';

const vite = await createViteServer({
	server: { middlewareMode: true },
	appType: 'spa',
});

const server = http.createServer((req, res) => {
	const url = req.url || '/';

	if (url.startsWith('/api/')) {
		handleApi(req, res);
		return;
	}

	handleStatic(req, res, () => {
		vite.middlewares(req, res, () => {
			res.statusCode = 404;
			res.end('Not found');
		});
	});
});

server.listen(PORT, () => {
	console.log(`\n  博客编辑器  →  http://localhost:${PORT}\n`);
});
