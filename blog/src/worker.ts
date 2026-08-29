// 轻量入口：静态资产照常由 ASSETS 提供，仅对 /live2d/ 做防盗链校验。
// 规则：同源请求、直接在地址栏打开（Sec-Fetch-Site: none）、无来源头均放行；
// 其他网站的页面嵌入或直链（cross-site）返回 403，防止外站盗用模型链接。

interface Env {
	ASSETS: { fetch(request: Request): Promise<Response> };
}

function isAllowedSource(request: Request): boolean {
	const fetchSite = request.headers.get('sec-fetch-site');
	if (fetchSite) return fetchSite !== 'cross-site';

	const origin = request.headers.get('origin');
	if (!origin) return true;
	try {
		return new URL(origin).hostname === new URL(request.url).hostname;
	} catch {
		return false;
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const { pathname } = new URL(request.url);
		if (pathname.startsWith('/live2d/') && !isAllowedSource(request)) {
			return new Response('Forbidden', { status: 403 });
		}
		return env.ASSETS.fetch(request);
	},
};
