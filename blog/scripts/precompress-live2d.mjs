/**
 * 预压缩 Live2D 模型：dist/live2d 下的 model.moc3 -> model.moc3.br
 *
 * 为什么需要这一步：
 *   moc3 是二进制，而 Cloudflare 的自动压缩是**按 Content-Type 判断**的。
 *   .moc3 没有对应 MIME，实测生产响应里 content-type 是空的，CF 直接跳过压缩；
 *   同目录的 .js 因为类型明确，全都被压成了 zstd。
 *   实测 brotli q11 把 model.moc3 从 1158KB 压到 306KB（26%），零画质损失。
 *
 * 为什么不在 Worker 里实时压：
 *   Workers 没有 brotli API（只有 deflate-raw），而且每次请求都要烧 CPU。
 *   构建期压一次、之后直接吐静态文件，更快也更省。
 *
 * 产物落在 dist/ 下（已被 .gitignore 忽略），由 worker.ts 按 Accept-Encoding 协商返回。
 * 找不到 .br 时 Worker 会回退到原始 moc3，所以这一步失败不会导致模型加载不了。
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';

const root = join(import.meta.dirname, '..', 'dist', 'live2d');

function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) out.push(...walk(full));
		else if (name.endsWith('.moc3')) out.push(full);
	}
	return out;
}

let files;
try {
	files = walk(root);
} catch {
	console.error(`预压缩失败：找不到 ${root}，请先跑 astro build`);
	process.exit(1);
}

if (!files.length) {
	console.error(`预压缩失败：${root} 下没有 .moc3`);
	process.exit(1);
}

let before = 0;
let after = 0;
for (const file of files) {
	const raw = readFileSync(file);
	const br = brotliCompressSync(raw, {
		params: {
			[constants.BROTLI_PARAM_QUALITY]: 11,
			[constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
		},
	});
	writeFileSync(`${file}.br`, br);
	before += raw.length;
	after += br.length;
	const rel = file.slice(root.length + 1).replace(/\\/g, '/');
	console.log(
		`  ${rel}  ${(raw.length / 1024).toFixed(0)}KB -> ${(br.length / 1024).toFixed(0)}KB`,
	);
}
console.log(
	`Live2D 预压缩完成：${files.length} 个模型，` +
		`${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB` +
		`（省 ${((1 - after / before) * 100).toFixed(0)}%）`,
);
