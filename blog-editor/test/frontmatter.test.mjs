import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFrontmatter, serializePost, validateFields } from '../server/frontmatter.mjs';
import { safeAssetName } from '../server/paths.mjs';

const SAMPLE = `---
title: '给洛茜的 mod 配上语音'
description: '人物换了、声音没换。'
pubDate: 'Sep 25 2026'
heroImage: '../../assets/covers/tts-studio-workbench.png'
heroImageAlt: '封面'
---

## 起因

一开始其实就是给纳塔打了个洛茜的 mod。
`;

test('解析出四项已知字段和正文', () => {
	const { fields, extras, body, hasFrontmatter } = parseFrontmatter(SAMPLE);
	assert.equal(hasFrontmatter, true);
	assert.equal(fields.title, '给洛茜的 mod 配上语音');
	assert.equal(fields.pubDate, 'Sep 25 2026');
	assert.equal(fields.heroImage, '../../assets/covers/tts-studio-workbench.png');
	assert.deepEqual(extras, []);
	assert.equal(body, '## 起因\n\n一开始其实就是给纳塔打了个洛茜的 mod。\n');
});

test('没有 frontmatter 时原样返回正文', () => {
	const { fields, body, hasFrontmatter, extras } = parseFrontmatter('## 只有正文\n');
	assert.equal(hasFrontmatter, false);
	assert.deepEqual(fields, {});
	assert.deepEqual(extras, []);
	assert.equal(body, '## 只有正文\n');
});

test('序列化 → 再解析 是稳定的（round-trip）', () => {
	const { fields, extras, body } = parseFrontmatter(SAMPLE);
	const text = serializePost(fields, extras, body);
	const again = parseFrontmatter(text);
	assert.deepEqual(again.fields, fields);
	assert.equal(again.body, body);
});

test('标题里的单引号按 YAML 规则翻倍且能还原', () => {
	const fields = { title: "it's a 'test'", description: '', pubDate: 'Sep 25 2026' };
	const text = serializePost(fields, [], '正文');
	assert.ok(text.includes("title: 'it''s a ''test'''"));
	assert.equal(parseFrontmatter(text).fields.title, "it's a 'test'");
});

test('未知键原样保留，不会被吃掉', () => {
	const raw = `---\ntitle: 'x'\ndescription: 'y'\npubDate: 'Sep 25 2026'\nfutureKey: 'keep me'\n---\n\n正文\n`;
	const { fields, extras } = parseFrontmatter(raw);
	assert.deepEqual(extras, ["futureKey: 'keep me'"]);
	const text = serializePost(fields, extras, '正文');
	assert.ok(text.includes("futureKey: 'keep me'"));
});

test('空的可选字段不写进文件，必填字段永远写', () => {
	const text = serializePost({ title: 'T', description: '', pubDate: 'Sep 25 2026' }, [], '');
	assert.ok(text.includes("title: 'T'"));
	assert.ok(text.includes("description: ''"));
	assert.ok(!text.includes('updatedDate'));
	assert.ok(!text.includes('heroImage'));
});

test('校验能抓出缺字段和坏日期', () => {
	assert.deepEqual(validateFields({ title: 'T', description: 'D', pubDate: 'Sep 25 2026' }), []);
	const bad = validateFields({ title: '', description: 'D', pubDate: '不是日期' });
	assert.equal(bad.length, 2);
});

test('图片文件名被清洗成安全形态', () => {
	assert.equal(safeAssetName('Screenshot 2026-09-25 123456.PNG'), 'screenshot-2026-09-25-123456.png');
	assert.equal(safeAssetName('截图.png'), 'image.png');
	assert.equal(safeAssetName('a.png'), 'a.png');
});
