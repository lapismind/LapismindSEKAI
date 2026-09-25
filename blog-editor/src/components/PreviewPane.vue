<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { getRenderer } from '../lib/markdown';

const props = defineProps({
	body: { type: String, default: '' },
});

const html = ref('');
const ready = ref(false);
let timer = null;

async function render() {
	const renderer = await getRenderer();
	ready.value = true;
	html.value = renderer.render(props.body);
}

watch(
	() => props.body,
	() => {
		clearTimeout(timer);
		timer = setTimeout(render, 150);
	},
	{ immediate: true },
);

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
	<div class="preview-sheet prose" data-testid="preview">
		<div v-if="html" v-html="html"></div>
		<p v-else-if="!ready" class="text-muted">正在准备预览…</p>
		<p v-else class="text-muted">正文还是空的。</p>
	</div>
</template>
