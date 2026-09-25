<script setup>
import { ref } from 'vue';

const props = defineProps({
	slug: { type: String, default: '' },
	fields: { type: Object, required: true },
});

const emit = defineEmits(['update', 'pick-cover']);

const collapsed = ref(localStorage.getItem('blog-editor-fm-collapsed') === '1');

function toggle() {
	collapsed.value = !collapsed.value;
	localStorage.setItem('blog-editor-fm-collapsed', collapsed.value ? '1' : '0');
}

function set(key, value) {
	emit('update', { ...props.fields, [key]: value });
}

function coverSrc(rel) {
	if (!rel) return '';
	return rel.replace(/^\.\.\/\.\.\/assets\//, '/blog-assets/').replace(/^\/assets\//, '/blog-assets/');
}
</script>

<template>
	<section class="flex flex-col gap-3 border-b border-line px-5 py-3">
		<div class="flex items-center justify-between gap-3">
			<div class="flex min-w-0 items-center gap-3">
				<span class="field-label">frontmatter</span>
				<span v-if="collapsed" class="text-muted truncate text-xs">{{ fields.title || '（未命名）' }}</span>
			</div>
			<div class="flex shrink-0 items-center gap-3">
				<code class="text-muted text-xs">{{ slug }}.md</code>
				<button class="text-muted text-xs underline" @click="toggle">
					{{ collapsed ? '展开' : '收起' }}
				</button>
			</div>
		</div>

		<template v-if="!collapsed">

		<label class="flex flex-col gap-1">
			<span class="field-label">标题 title</span>
			<input
				class="field-input"
				:value="fields.title || ''"
				placeholder="文章标题"
				data-testid="field-title"
				@input="set('title', $event.target.value)"
			/>
		</label>

		<label class="flex flex-col gap-1">
			<span class="field-label">摘要 description</span>
			<textarea
				class="field-input resize-y"
				rows="2"
				:value="fields.description || ''"
				placeholder="一段话，出现在文章列表和分享卡上"
				@input="set('description', $event.target.value)"
			></textarea>
		</label>

		<div class="grid grid-cols-2 gap-3">
			<label class="flex flex-col gap-1">
				<span class="field-label">发布 pubDate</span>
				<input
					class="field-input"
					:value="fields.pubDate || ''"
					placeholder="Sep 25 2026"
					@input="set('pubDate', $event.target.value)"
				/>
			</label>
			<label class="flex flex-col gap-1">
				<span class="field-label">更新 updatedDate</span>
				<input
					class="field-input"
					:value="fields.updatedDate || ''"
					placeholder="留空则不写"
					@input="set('updatedDate', $event.target.value)"
				/>
			</label>
		</div>

		<div class="flex items-start gap-4">
			<div class="flex flex-1 flex-col gap-1">
				<span class="field-label">封面 heroImage</span>
				<div class="flex items-center gap-2">
					<button class="rounded-full border border-line px-3 py-1 text-xs" @click="emit('pick-cover')">
						选图片当封面
					</button>
					<button
						v-if="fields.heroImage"
						class="text-muted text-xs underline"
						@click="set('heroImage', '')"
					>
						清除
					</button>
				</div>
				<input
					class="field-input"
					:value="fields.heroImage || ''"
					placeholder="../../assets/covers/xxx.png"
					data-testid="field-cover"
					@input="set('heroImage', $event.target.value)"
				/>
				<input
					class="field-input"
					:value="fields.heroImageAlt || ''"
					placeholder="封面 alt 文案"
					@input="set('heroImageAlt', $event.target.value)"
				/>
			</div>
			<img
				v-if="fields.heroImage"
				:src="coverSrc(fields.heroImage)"
				alt="封面预览"
				class="h-24 w-40 rounded-lg border border-line object-cover"
			/>
		</div>
		</template>
	</section>
</template>
