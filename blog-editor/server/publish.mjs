// 发布：校验 → npm run build → npx wrangler deploy，逐行回吐日志。
import { spawn } from 'node:child_process';
import { BLOG_ROOT } from './paths.mjs';
import { validateFields } from './frontmatter.mjs';
import { assetExists } from './assets.mjs';

let running = false;

function run(command, onLine) {
	return new Promise((resolve) => {
		const child = spawn(command, { cwd: BLOG_ROOT, shell: true });
		const pump = (buf) => {
			for (const line of String(buf).split(/\r?\n/)) {
				if (line.trim()) onLine(line);
			}
		};
		child.stdout.on('data', pump);
		child.stderr.on('data', pump);
		child.on('close', (code) => resolve(code ?? 1));
	});
}

/**
 * @param {{ fields: object, onEvent: (event: object) => void }} input
 */
export async function publish({ fields, onEvent }) {
	if (running) {
		onEvent({ type: 'error', message: '已经有一个发布在跑，等它结束' });
		return;
	}
	running = true;
	try {
		const errors = validateFields(fields);
		if (fields.heroImage && !(await assetExists(fields.heroImage))) {
			errors.push(`封面文件不存在：${fields.heroImage}`);
		}
		if (errors.length) {
			onEvent({ type: 'error', message: '发布前校验没过，没有触发构建', errors });
			return;
		}

		onEvent({ type: 'step', step: 'build', message: '正在构建（npm run build）…' });
		const buildCode = await run('npm run build', (line) => onEvent({ type: 'log', line }));
		if (buildCode !== 0) {
			onEvent({ type: 'error', message: `构建失败（退出码 ${buildCode}），没有部署`, errors: [] });
			return;
		}
		onEvent({ type: 'step', step: 'deploy', message: '正在部署（npx wrangler deploy）…' });

		let versionId = '';
		const deployCode = await run('npx wrangler deploy', (line) => {
			const hit = line.match(/Current Version ID:\s*([0-9a-f-]+)/i);
			if (hit) versionId = hit[1];
			onEvent({ type: 'log', line });
		});
		if (deployCode !== 0) {
			onEvent({ type: 'error', message: `部署失败（退出码 ${deployCode}）`, errors: [] });
			return;
		}
		onEvent({ type: 'done', versionId, url: 'https://blog.qmzhj.top' });
	} finally {
		running = false;
	}
}
