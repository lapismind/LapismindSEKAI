// 收图：落到 blog/src/assets/posts|/covers，返回可直接写进 markdown 的相对路径。
import fs from 'node:fs/promises';
import path from 'node:path';
import {
	POST_ASSETS_DIR,
	COVER_ASSETS_DIR,
	POST_ASSET_PREFIX,
	COVER_ASSET_PREFIX,
	safeAssetName,
} from './paths.mjs';

async function uniquePath(dir, filename) {
	const ext = path.extname(filename);
	const stem = path.basename(filename, ext);
	let candidate = filename;
	let n = 2;
	for (;;) {
		try {
			await fs.access(path.join(dir, candidate));
			candidate = `${stem}-${n++}${ext}`;
		} catch {
			return candidate;
		}
	}
}

/**
 * @param {{ kind?: 'post'|'cover', name: string, data: Buffer }} input
 * @returns {Promise<{ file: string, rel: string }>} rel 是写进 markdown 的路径
 */
export async function saveAsset({ kind = 'post', name, data }) {
	const dir = kind === 'cover' ? COVER_ASSETS_DIR : POST_ASSETS_DIR;
	const prefix = kind === 'cover' ? COVER_ASSET_PREFIX : POST_ASSET_PREFIX;
	await fs.mkdir(dir, { recursive: true });
	const file = await uniquePath(dir, safeAssetName(name));
	await fs.writeFile(path.join(dir, file), data);
	return { file, rel: `${prefix}/${file}` };
}

export async function assetExists(rel) {
	if (!rel) return false;
	const marker = '/assets/';
	const at = String(rel).indexOf(marker);
	if (at === -1) return false;
	const tail = String(rel).slice(at + marker.length);
	const abs = path.join(path.dirname(POST_ASSETS_DIR), tail);
	try {
		await fs.access(abs);
		return true;
	} catch {
		return false;
	}
}
