// 轻量入口：静态资产照常由 ASSETS 提供，只做四件额外的事。
//
// 1. 老域名 308：sekai.qmzhj.top（新主域）与 blog.qmzhj.top（老域）都绑在本 Worker 上
//    （见 wrangler.toml 的两条 routes）。资产请求默认不过 Worker，所以 run_worker_first
//    开成 true——老域名的每个请求都进到这里，308（永久重定向）到新域名，
//    保留 path + query，旧链接与搜索收录无损迁移。
//
// 2. /live2d/ 防盗链：同源请求、直接在地址栏打开（Sec-Fetch-Site: none）、
//    无来源头均放行；其他网站的页面嵌入或直链（cross-site）返回 403。
//
// 3. /live2d/ 的传输优化：
//    - 缓存：子目录资产的名字里没有内容哈希，所以不给 immutable，只给 1 天。
//      之前是全站默认的 max-age=0, must-revalidate，重复访问每次都要往返校验。
//    - moc3 压缩：CF 的自动压缩按 Content-Type 判断，而 .moc3 没有 MIME，
//      实测生产响应 content-type 为空 → CF 完全不压（1158KB 原样传）。
//      构建期已预压成 model.moc3.br（见 scripts/precompress-live2d.mjs），这里直接返回。
//
// 两个容易踩的坑，都已实测确认：
//   a. 必须在 ResponseInit 里写 encodeBody: 'manual'。
//      Worker 返回的 body 默认被当作"未压缩数据"，运行时会按 Content-Encoding
//      再压一遍 —— 结果是客户端解一次拿到的是 .br 文件本身，模型直接加载失败。
//      实测症状：浏览器收到的 313374 字节与 .br 文件 sha256 完全一致。
//   b. 不做 Accept-Encoding 协商。wrangler dev 会把进来的 Accept-Encoding 一律
//      改写成 "br, gzip"（本地测不出负面路径），而且 CF 边缘本身就会在客户端
//      不支持 br 时自动解压——协商既测不了、也没必要。
//
// 注意：这里的响应由 Worker 生成，_headers 文件对它们不生效（CF 文档明确）。
// 所以 /live2d/ 的缓存头必须在本文件里设，其余静态目录才走 public/_headers。

interface Env {
	ASSETS: { fetch(request: Request): Promise<Response> };
	// /api/visits 用：三值任缺则端点返回 404，前端自动隐藏访客数
	CF_API_TOKEN?: string;
	CF_ACCOUNT_ID?: string;
	CF_RUM_SITE_TAG?: string;
}

// 项目不装 @cloudflare/workers-types（见下方 CfResponseInit 的注释），只声明用到的面
interface CfExecutionContext {
	waitUntil(promise: Promise<unknown>): void;
}
interface CacheLike {
	match(request: Request): Promise<Response | undefined>;
	put(request: Request, response: Response): Promise<void>;
}

/** /api/visits 的 RUM 聚合组（GraphQL rumPageloadEventsAdaptiveGroups 行）。
 *  sum 里只有 visits；每次 pageload 事件即一次 PV，pageViews 用 count。 */
type RumGroups = { count?: number; sum?: { visits?: number } }[] | undefined;

// encodeBody 是 Cloudflare 运行时的专有选项，标准 lib.dom 的 ResponseInit 里没有。
// 实测 workerd 只接受 'manual'——写 'auto' 会抛 "encodeBody: unexpected value: auto"，
// 所以"不手动编码"的做法是干脆不设这个属性。
type CfResponseInit = ResponseInit & { encodeBody?: 'manual' };

const LIVE2D_CACHE = 'public, max-age=86400';

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

/**
 * 取构建期预压缩的 moc3。产物不存在时返回 null，由调用方回退到原始文件——
 * 预压缩只是构建的一个后置步骤，失败了也不能让看板娘打不开。
 */
async function fetchPrecompressed(
	request: Request,
	env: Env,
	pathname: string,
): Promise<Response | null> {
	const url = new URL(request.url);
	url.pathname = `${pathname}.br`;
	const res = await env.ASSETS.fetch(new Request(url, { headers: request.headers }));
	// 严格判 200：项目配了 not_found_handling = "404-page"，
	// 缺文件时会拿回 404 页面（HTML），不能当成压缩产物用。
	if (res.status !== 200) return null;
	if ((res.headers.get('Content-Type') || '').includes('text/html')) return null;
	return res;
}

/**
 * /api/visits：从 Web Analytics 的 RUM 数据集查真实访客数（beacon 上报，
 * 不含爬虫与静态资源——zone 级的 httpRequestsOverviewAdaptiveGroups 不是人流量）。
 * 同源接口，无 CORS；结果边缘缓存 10 分钟，避免每次进页都打 GraphQL。
 * 今夜 = UTC+8 当日零点起（「25時」的夜属于今天）。
 */
async function handleVisits(
	request: Request,
	env: Env,
	ctx: CfExecutionContext,
): Promise<Response> {
	const headers = {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'public, max-age=600',
	};
	const json = (body: unknown, status: number) =>
		new Response(JSON.stringify(body), { status, headers });

	if (!isAllowedSource(request)) return new Response('Forbidden', { status: 403 });
	if (!env.CF_API_TOKEN || !env.CF_ACCOUNT_ID || !env.CF_RUM_SITE_TAG) {
		return json({ ok: false, reason: 'not-configured' }, 404);
	}

	const cache = (caches as unknown as { default: CacheLike }).default;
	const cached = await cache.match(request);
	if (cached) return cached;

	const now = new Date();
	// UTC+8 当日零点：当日 UTC 零点再减 8 小时
	const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 8 * 3600_000;
	const weekStart = dayStart - 6 * 86400_000;
	const query = `
	query($accountTag: String!, $siteTag: String!, $dayStart: Time!, $weekStart: Time!, $now: Time!) {
		viewer {
			accounts(filter: { accountTag: $accountTag }) {
				today: rumPageloadEventsAdaptiveGroups(filter: { siteTag: $siteTag, datetime_geq: $dayStart, datetime_leq: $now }, limit: 1) {
					count
					sum { visits }
				}
				week: rumPageloadEventsAdaptiveGroups(filter: { siteTag: $siteTag, datetime_geq: $weekStart, datetime_leq: $now }, limit: 1) {
					count
					sum { visits }
				}
			}
		}
	}`;
	const resp = await fetch('https://api.cloudflare.com/client/v4/graphql', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.CF_API_TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query,
			variables: {
				accountTag: env.CF_ACCOUNT_ID,
				siteTag: env.CF_RUM_SITE_TAG,
				dayStart: new Date(dayStart).toISOString(),
				weekStart: new Date(weekStart).toISOString(),
				now: now.toISOString(),
			},
		}),
	});
	if (!resp.ok) return json({ ok: false, reason: 'upstream' }, 502);
	const payload: {
		data?: { viewer?: { accounts?: Array<{ today?: RumGroups; week?: RumGroups }> } };
	} = await resp.json();
	const account = payload.data?.viewer?.accounts?.[0];
	if (!account) return json({ ok: false, reason: 'no-data' }, 502);
	const pick = (g: RumGroups) => ({
		visits: g?.[0]?.sum?.visits ?? 0,
		pageViews: g?.[0]?.count ?? 0,
	});
	const res = json(
		{
			ok: true,
			today: pick(account.today),
			week: pick(account.week),
		},
		200,
	);
	ctx.waitUntil(cache.put(request, res.clone()));
	return res;
}

export default {
	async fetch(request: Request, env: Env, ctx: CfExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// 老域名整站 308 到新域名（永久，保留 path + query；见文件头注释 1）
		if (url.hostname === 'blog.qmzhj.top') {
			return Response.redirect(new URL(`${url.pathname}${url.search}`, 'https://sekai.qmzhj.top'), 308);
		}

		const { pathname } = url;

		if (pathname === '/api/visits') {
			return handleVisits(request, env, ctx);
		}

		if (!pathname.startsWith('/live2d/')) {
			return env.ASSETS.fetch(request);
		}

		if (!isAllowedSource(request)) {
			return new Response('Forbidden', { status: 403 });
		}

		if (pathname.endsWith('.moc3')) {
			const br = await fetchPrecompressed(request, env, pathname);
			if (br) {
				const headers = new Headers(br.headers);
				headers.set('Content-Encoding', 'br');
				headers.set('Content-Type', 'application/octet-stream');
				headers.set('Cache-Control', LIVE2D_CACHE);
				const init: CfResponseInit = {
					status: 200,
					headers,
					// 见文件头注释 a：少了这行会把已压缩的 body 再压一次
					encodeBody: 'manual',
				};
				return new Response(br.body, init);
			}
		}

		// 其余情况：拷一份头、只改缓存头，body 原样传。
		// 不能直接改 res.headers —— fetch 响应的头是只读的（实测改了会 500）。
		// 也不能无脑 new Response(res.body, ...)：资产层可能已经按 Content-Encoding
		// 压缩过 body，运行时默认会再压一次。所以按响应自身的状态决定：
		// 带了 Content-Encoding 就是"已编码的 body"，必须声明 manual；否则不设，交默认处理。
		const res = await env.ASSETS.fetch(request);
		const headers = new Headers(res.headers);
		if (res.status === 200) headers.set('Cache-Control', LIVE2D_CACHE);
		const init: CfResponseInit = {
			status: res.status,
			statusText: res.statusText,
			headers,
		};
		if (res.headers.has('Content-Encoding')) init.encodeBody = 'manual';
		return new Response(res.body, init);
	},
};
