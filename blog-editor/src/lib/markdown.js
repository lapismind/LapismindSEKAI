// markdown 渲染：markdown-it + Shiki，主题和博客一致（github-light / github-dark）。
// 图片路径从 `../../assets/...` 改写到后端挂的 `/blog-assets/...`。
import MarkdownIt from 'markdown-it';
import { createHighlighter } from 'shiki';
import { fromHighlighter } from '@shikijs/markdown-it';

const LANGS = [
	'javascript',
	'typescript',
	'jsx',
	'tsx',
	'vue',
	'html',
	'css',
	'json',
	'yaml',
	'markdown',
	'python',
	'bash',
	'shell',
	'sql',
	'diff',
	'astro',
];

let renderer = null;

function rewriteAssets(html) {
	return html
		.replaceAll('src="../../assets/', 'src="/blog-assets/')
		.replaceAll('src="../assets/', 'src="/blog-assets/');
}

export async function getRenderer() {
	if (renderer) return renderer;

	const highlighter = await createHighlighter({
		themes: ['github-light', 'github-dark'],
		langs: LANGS,
	});

	const md = new MarkdownIt({ html: true, linkify: true });
	md.use(
		fromHighlighter(highlighter, {
			themes: { light: 'github-light', dark: 'github-dark' },
			defaultColor: false,
			defaultLanguage: 'text',
		}),
	);

	renderer = {
		render(text) {
			return rewriteAssets(md.render(String(text ?? '')));
		},
	};
	return renderer;
}
