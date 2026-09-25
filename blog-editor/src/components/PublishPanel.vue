<script setup>
import { onBeforeUnmount, ref } from 'vue';

const props = defineProps({
	slug: { type: String, required: true },
});
const emit = defineEmits(['close', 'published']);

const lines = ref([]);
const phase = ref('idle'); // idle | running | done | error
const errorText = ref('');
const versionId = ref('');
let source = null;

function push(line) {
	lines.value.push(line);
	if (lines.value.length > 500) lines.value.shift();
}

function start() {
	phase.value = 'running';
	lines.value = [];
	errorText.value = '';
	versionId.value = '';

	source = new EventSource(`/api/publish?slug=${encodeURIComponent(props.slug)}`);
	source.onmessage = (event) => {
		const data = JSON.parse(event.data);
		if (data.type === 'log') push(data.line);
		else if (data.type === 'step') push(`── ${data.message}`);
		else if (data.type === 'done') {
			phase.value = 'done';
			versionId.value = data.versionId || '';
			source.close();
			emit('published');
		} else if (data.type === 'error') {
			phase.value = 'error';
			errorText.value = data.message;
			(data.errors || []).forEach(push(`· ${p}`));
			source.close();
		}
	};
	source.onerror = () => {
		if (phase.value === 'running') {
			phase.value = 'error';
			errorText.value = '连接中断，看看终端里 npm run dev 的日志';
		}
		source?.close();
	};
}

onBeforeUnmount(() => source?.close());
</script>

<template>
	<div class="fixed inset-0 z-50 flex justify-end" style="background: var(--overlay, rgb(0 0 0 / 0.25))">
		<div
			class="flex h-full w-[42rem] max-w-[92vw] flex-col border-l border-line bg-surface-solid"
		>
			<header class="flex items-center justify-between border-b border-line px-5 py-4">
				<div>
					<span class="field-label">publish</span>
					<h2 class="text-ink m-0 text-lg">保存并发布到线上</h2>
				</div>
				<button class="text-muted text-sm" @click="emit('close')">关闭</button>
			</header>

			<div class="flex items-center gap-3 border-b border-line px-5 py-3">
				<button
					class="rounded-full bg-brand-500 px-4 py-1.5 text-sm text-white disabled:opacity-50"
					:disabled="phase === 'running'"
					data-testid="publish-run"
					@click="start"
				>
					{{ phase === 'running' ? '发布中…' : '开始发布' }}
				</button>
				<span class="text-muted text-xs">
					先保存当前文章 → npm run build → npx wrangler deploy
				</span>
			</div>

			<div v-if="errorText" class="border-b border-danger-line bg-danger-soft px-5 py-3 text-sm text-danger">
				{{ errorText }}
			</div>
			<div
				v-if="phase === 'done'"
				class="border-b border-line bg-primary-ghost px-5 py-3 text-sm text-ink"
			>
				发布成功。Version ID：<code>{{ versionId || '（未解析到）' }}</code>
			</div>

			<pre
				class="text-ink-soft m-0 flex-1 overflow-auto bg-transparent px-5 py-4 font-mono text-xs leading-relaxed"
				data-testid="publish-log"
				>{{ lines.join('\n') || '（还没有日志）' }}</pre
			>
		</div>
	</div>
</template>
