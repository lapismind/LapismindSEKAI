<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import FrontmatterForm from './components/FrontmatterForm.vue';
import MarkdownEditor from './components/MarkdownEditor.vue';
import PreviewPane from './components/PreviewPane.vue';
import PublishPanel from './components/PublishPanel.vue';
import { api } from './lib/api.js';

const posts = ref([]);
const slug = ref('');
const fields = ref({});
const extras = ref([]);
const body = ref('');

const loading = ref(false);
const saving = ref(false);
const dirty = ref(false);
const savedAt = ref('');
const statusText = ref('');
const uploadNote = ref('');

const dark = ref(localStorage.getItem('blog-editor-theme') === 'dark');
const publishOpen = ref(false);
const newOpen = ref(false);
const newTitle = ref('');
const newSlug = ref('');

const editor = ref(null);
let saveTimer = null;
let noteTimer = null;
const savingPromise = ref(null);

// 磁盘上那份的指纹：内容没变就绝不写盘——否则"点开看一眼"也会重写文件。
const pristine = ref('');
const snapshot = () => JSON.stringify({ f: fields.value, e: extras.value, b: body.value });
const markPristine = () => {
	pristine.value = snapshot();
	dirty.value = false;
};

const statusLabel = computed(() => (saving.value ? '保存中…' : dirty.value ? '有未保存改动' : savedAt.value));

function flashNote(text) {
	uploadNote.value = text;
	clearTimeout(noteTimer);
	noteTimer = setTimeout(() => (uploadNote.value = ''), 2500);
}

async function loadPosts() {
	posts.value = await api.listPosts();
}

async function openPost(next) {
	if (!next || next === slug.value) return;
	if (dirty.value) await save();
	loading.value = true;
	try {
		const post = await api.readPost(next);
		slug.value = post.slug;
		fields.value = post.fields;
		extras.value = post.extras;
		body.value = post.body;
		// 等 watcher 跑完再放开 loading，否则刚载入就会被自动保存写一次盘
		await nextTick();
		markPristine();
		savedAt.value = '已加载';
		statusText.value = '';
		localStorage.setItem('blog-editor-last', next);
	} catch (err) {
		statusText.value = `打开失败：${err.message}`;
	} finally {
		loading.value = false;
	}
}

async function save(force = false) {
	if (!slug.value) return;
	// 已经有一次保存在飞：等它，别丢改动
	if (savingPromise.value) return savingPromise.value;
	if (!force && snapshot() === pristine.value) {
		dirty.value = false;
		return;
	}
	saving.value = true;
	savingPromise.value = (async () => {
		try {
			await api.savePost(slug.value, { fields: fields.value, extras: extras.value, body: body.value });
			markPristine();
			const now = new Date();
			savedAt.value = `已保存 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
			statusText.value = '';
		} catch (err) {
			statusText.value = `保存失败：${err.message}`;
		} finally {
			saving.value = false;
			savingPromise.value = null;
		}
	})();
	return savingPromise.value;
}

/** 发布读的是磁盘上的文件，所以必须先确保落盘。 */
async function openPublish() {
	clearTimeout(saveTimer);
	await save();
	if (dirty.value || statusText.value.startsWith('保存失败')) return;
	publishOpen.value = true;
}

function scheduleSave() {
	dirty.value = true;
	clearTimeout(saveTimer);
	saveTimer = setTimeout(save, 900);
}

async function uploadImage(file, kind = 'post') {
	flashNote(`上传 ${file.name || '粘贴的图片'}…`);
	try {
		const { rel, file: name } = await api.uploadAsset(file, kind);
		if (kind === 'cover') {
			fields.value = {
				...fields.value,
				heroImage: rel,
				heroImageAlt: fields.value.heroImageAlt || fields.value.title || name,
			};
		} else {
			const alt = name.replace(/\.[^.]+$/, '');
			editor.value?.insertAtCursor(`\n![${alt}](${rel})\n`);
		}
		flashNote(kind === 'cover' ? `封面已设为 ${name}` : `已插入 ${name}`);
	} catch (err) {
		flashNote(`上传失败：${err.message}`);
	}
}

async function pickFile(kind) {
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = 'image/*';
	input.multiple = kind === 'post';
	input.onchange = async () => {
		for (const file of Array.from(input.files || [])) await uploadImage(file, kind);
	};
	input.click();
}

function onH1(title) {
	if (!fields.value.title) {
		fields.value = { ...fields.value, title };
		flashNote(`标题已取自正文：${title}`);
	}
}

function autoSlug(text) {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

async function createPost() {
	const title = newTitle.value.trim();
	const wanted = newSlug.value.trim();
	if (!title || !wanted) return;
	try {
		const post = await api.createPost({ slug: wanted, title });
		await loadPosts();
		newOpen.value = false;
		newTitle.value = '';
		newSlug.value = '';
		slug.value = post.slug;
		fields.value = post.fields;
		extras.value = post.extras;
		body.value = post.body;
		await nextTick();
		markPristine();
		savedAt.value = '已新建';
	} catch (err) {
		statusText.value = `新建失败：${err.message}`;
	}
}

watch([fields, body], () => {
	if (!loading.value) scheduleSave();
});
watch([fields, body, extras], () => {
	if (!loading.value) dirty.value = true;
});

watch(newTitle, (value) => {
	if (!newSlug.value) newSlug.value = autoSlug(value);
});

watch(
	dark,
	(value) => {
		document.documentElement.dataset.theme = value ? 'dark' : 'light';
		localStorage.setItem('blog-editor-theme', value ? 'dark' : 'light');
	},
	{ immediate: true },
);

onMounted(async () => {
	document.documentElement.dataset.theme = dark.value ? 'dark' : 'light';
	await loadPosts();
	const last = localStorage.getItem('blog-editor-last');
	const first = posts.value.find((p) => p.slug === last)?.slug || posts.value[0]?.slug;
	if (first) await openPost(first);
});

onBeforeUnmount(() => {
	clearTimeout(saveTimer);
	clearTimeout(noteTimer);
});
</script>

<template>
	<div class="flex h-full flex-col bg-page text-ink-soft">
		<header
			class="flex flex-wrap items-center gap-3 border-b border-line bg-surface-solid px-5 py-3"
		>
			<strong class="text-ink">博客编辑器</strong>
			<span class="text-muted text-xs">LapismindSEKAI / blog</span>

			<select
				class="field-input w-64"
				:value="slug"
				data-testid="post-select"
				@change="openPost($event.target.value)"
			>
				<option v-for="p in posts" :key="p.slug" :value="p.slug">
					{{ p.title }}（{{ p.slug }}）
				</option>
			</select>

			<button class="btn btn-ghost" @click="newOpen = true">新建</button>
			<button class="btn btn-ghost" @click="pickFile('post')">插入图片</button>

			<span class="flex-1"></span>
			<span class="text-muted text-xs" data-testid="save-status">{{ statusText || statusLabel }}</span>
			<button class="btn btn-ghost" :disabled="!slug" @click="save">保存</button>
			<button class="btn btn-primary" :disabled="!slug" @click="openPublish">
				保存并发布
			</button>
			<button class="btn btn-ghost" @click="dark = !dark">{{ dark ? '☀' : '☾' }}</button>
		</header>

		<div v-if="uploadNote" class="border-b border-line bg-primary-ghost px-5 py-2 text-xs text-ink">
			{{ uploadNote }}
		</div>

		<div class="app-grid">
			<section class="pane flex flex-col border-r border-line">
				<FrontmatterForm
					v-if="slug"
					:slug="slug"
					:fields="fields"
					@update="fields = $event"
					@pick-cover="pickFile('cover')"
				/>
				<div class="min-h-0 flex-1">
					<MarkdownEditor
						ref="editor"
						v-model="body"
						:dark="dark"
						:auto-title="!fields.title"
						@save="save"
						@image="uploadImage($event, 'post')"
						@h1="onH1"
					/>
				</div>
				<footer class="border-t border-line px-5 py-2 text-muted text-xs">
					正文可直接拖入 / 粘贴图片；粘贴以 <code># 标题</code> 开头的文本时，标题栏为空就自动把这一行提到 frontmatter
				</footer>
			</section>

			<section class="pane px-6 py-6">
				<PreviewPane :body="body" />
			</section>
		</div>

		<PublishPanel v-if="publishOpen" :slug="slug" @close="publishOpen = false" />

		<div v-if="newOpen" class="fixed inset-0 z-50 grid place-items-center" style="background: var(--overlay, rgb(0 0 0 / 0.25))">
			<div class="w-[30rem] max-w-[92vw] rounded-2xl border border-line bg-surface-solid p-6">
				<h2 class="text-ink m-0 text-lg">新建文章</h2>
				<label class="mt-4 flex flex-col gap-1">
					<span class="field-label">标题</span>
					<input
						v-model="newTitle"
						class="field-input"
						placeholder="文章标题"
						data-testid="new-title"
					/>
				</label>
				<label class="mt-3 flex flex-col gap-1">
					<span class="field-label">文件名 slug（小写字母/数字/连字符）</span>
					<input v-model="newSlug" class="field-input" placeholder="my-new-post" />
				</label>
				<p class="text-muted mt-2 text-xs">中文标题转不出 slug，自己起一个英文短名就行。</p>
				<div class="mt-5 flex justify-end gap-3">
					<button class="btn btn-ghost" @click="newOpen = false">取消</button>
					<button class="btn btn-primary" data-testid="new-confirm" @click="createPost">创建</button>
				</div>
			</div>
		</div>
	</div>
</template>
