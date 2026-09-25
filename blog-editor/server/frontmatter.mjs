// frontmatter 解析/序列化：纯函数，无 IO，可单测。
//
// 只支持博客现在用的形态：`---` 包起来的一层扁平标量键值。
// 未知键原样保留（原文照抄），避免编辑器吃掉将来新增的字段。

export const KNOWN_KEYS = [
	'title',
	'description',
	'pubDate',
	'updatedDate',
	'heroImage',
	'heroImageAlt',
];

// 必填三项：content.config.ts 里 title/description 是 z.string()，pubDate 是 z.coerce.date()
export const REQUIRED_KEYS = ['title', 'description', 'pubDate'];

const FM_RE = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

function unquote(raw) {
	const s = raw.trim();
	if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) {
		return s.slice(1, -1).replace(/''/g, "'");
	}
	if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
		return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
	}
	return s;
}

/** 单引号包裹，内部单引号翻倍——与博客现有手写 frontmatter 一致。 */
export function quote(value) {
	return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

/**
 * @returns {{ fields: Record<string,string>, extras: string[], body: string, hasFrontmatter: boolean }}
 * extras 是未知键的原始行（含 `key: value`），保存时原样写回。
 */
export function parseFrontmatter(raw) {
	const text = String(raw ?? '');
	const m = text.match(FM_RE);
	if (!m) {
		return { fields: {}, extras: [], body: text.replace(/^\uFEFF/, ''), hasFrontmatter: false };
	}

	const fields = {};
	const extras = [];
	for (const line of m[1].split(/\r?\n/)) {
		if (!line.trim()) continue;
		const at = line.indexOf(':');
		if (at === -1) {
			extras.push(line);
			continue;
		}
		const key = line.slice(0, at).trim();
		const value = unquote(line.slice(at + 1));
		if (KNOWN_KEYS.includes(key)) {
			fields[key] = value;
		} else {
			extras.push(line);
		}
	}

	return {
		fields,
		extras,
		body: text.slice(m[0].length).replace(/^\r?\n+/, ''),
		hasFrontmatter: true,
	};
}

/** 把 fields + extras + body 组装回完整文件文本。 */
export function serializePost(fields = {}, extras = [], body = '') {
	const lines = [];
	for (const key of KNOWN_KEYS) {
		const value = fields[key];
		if (value === undefined || value === null) {
			if (REQUIRED_KEYS.includes(key)) lines.push(`${key}: ${quote('')}`);
			continue;
		}
		if (!REQUIRED_KEYS.includes(key) && String(value).trim() === '') continue;
		lines.push(`${key}: ${quote(value)}`);
	}
	for (const extra of extras) {
		if (String(extra).trim()) lines.push(String(extra));
	}
	const cleanBody = String(body ?? '').replace(/^\r?\n+/, '');
	return `---\n${lines.join('\n')}\n---\n\n${cleanBody}`;
}

/** 发布前的校验：返回人类可读的错误列表，空数组表示通过。 */
export function validateFields(fields = {}) {
	const errors = [];
	for (const key of REQUIRED_KEYS) {
		if (!String(fields[key] ?? '').trim()) errors.push(`frontmatter 缺少 ${key}`);
	}
	if (fields.pubDate && Number.isNaN(new Date(fields.pubDate).getTime())) {
		errors.push(`pubDate 不是合法日期：${fields.pubDate}`);
	}
	return errors;
}
