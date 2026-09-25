<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorView, keymap, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { tags } from '@lezer/highlight';

const props = defineProps({
	modelValue: { type: String, default: '' },
	dark: { type: Boolean, default: false },
	/** 粘贴的首行是 `# 标题` 时，自动抽成标题（只在标题栏为空时由父级决定用不用） */
	autoTitle: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'save', 'image', 'h1']);

const host = ref(null);
let view = null;
let syncing = false;
const themeCompartment = new Compartment();

const highlight = HighlightStyle.define([
	{ tag: tags.heading, color: 'var(--primary)', fontWeight: '700' },
	{ tag: tags.strong, fontWeight: '700', color: 'var(--ink)' },
	{ tag: tags.emphasis, fontStyle: 'italic' },
	{ tag: tags.link, color: 'var(--primary)', textDecoration: 'underline' },
	{ tag: tags.url, color: 'var(--muted)' },
	{ tag: tags.quote, color: 'var(--muted)' },
	{ tag: tags.comment, color: 'var(--muted)' },
	{ tag: tags.monospace, color: 'var(--primary)' },
	{ tag: tags.keyword, color: 'var(--primary-2)' },
	{ tag: tags.string, color: 'var(--primary-bright)' },
	{ tag: tags.number, color: 'var(--primary-2)' },
	{ tag: tags.typeName, color: 'var(--primary)' },
]);

function themeFor(dark) {
	return EditorView.theme(
		{
			'&': { backgroundColor: 'transparent', color: 'var(--ink)', height: '100%' },
			'.cm-content': { caretColor: 'var(--primary)', padding: '1.1rem 0' },
			'.cm-gutters': {
				backgroundColor: 'transparent',
				color: 'var(--muted)',
				border: 'none',
				paddingLeft: '0.6rem',
			},
			'.cm-activeLine': { backgroundColor: 'var(--primary-ghost)' },
			'.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--primary)' },
			'&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
				backgroundColor: 'var(--primary-soft)',
			},
			'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--primary)' },
			'.cm-scroller': { overflow: 'auto' },
		},
		{ dark },
	);
}

function externalUpdate(text) {
	if (!view || syncing) return;
	if (view.state.doc.toString() === text) return;
	syncing = true;
	view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
	syncing = false;
}

onMounted(() => {
	view = new EditorView({
		parent: host.value,
		state: EditorState.create({
			doc: props.modelValue,
			extensions: [
				basicSetup,
				highlightActiveLine(),
				highlightActiveLineGutter(),
				markdown({ codeLanguages: languages }),
				syntaxHighlighting(highlight),
				EditorView.lineWrapping,
				themeCompartment.of(themeFor(props.dark)),
				keymap.of([
					{ key: 'Mod-s', preventDefault: true, run: () => (emit('save'), true) },
					indentWithTab,
					...defaultKeymap,
				]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged && !syncing) {
						emit('update:modelValue', update.state.doc.toString());
					}
				}),
				EditorView.domEventHandlers({
					paste: (event, editor) => {
						const items = Array.from(event.clipboardData?.items || []);
						for (const item of items) {
							if (item.type.startsWith('image/')) {
								const file = item.getAsFile();
								if (file) {
									event.preventDefault();
									emit('image', file);
									return true;
								}
							}
						}
						const text = event.clipboardData?.getData('text/plain') || '';
						const hit = text.match(/^#\s+(.+?)\r?\n+/);
						if (props.autoTitle && hit) {
							event.preventDefault();
							const rest = text.slice(hit[0].length);
							editor.dispatch(editor.state.replaceSelection(rest));
							emit('h1', hit[1].trim());
							return true;
						}
						return false;
					},
					drop: (event) => {
						const files = Array.from(event.dataTransfer?.files || []).filter((f) =>
							f.type.startsWith('image/'),
						);
						if (!files.length) return false;
						event.preventDefault();
						for (const file of files) emit('image', file);
						return true;
					},
				}),
			],
		}),
	});
});

watch(
	() => props.modelValue,
	(next) => externalUpdate(next ?? ''),
);

watch(
	() => props.dark,
	(next) => {
		view?.dispatch({ effects: themeCompartment.reconfigure(themeFor(next)) });
	},
);

onBeforeUnmount(() => {
	view?.destroy();
	view = null;
});

function insertAtCursor(text) {
	if (!view) return;
	view.dispatch(view.state.replaceSelection(text));
	view.focus();
}

defineExpose({ insertAtCursor });
</script>

<template>
	<div ref="host" class="cm-host h-full"></div>
</template>
