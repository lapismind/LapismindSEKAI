// 后端接口的薄封装。所有错误统一抛成带 message 的 Error，UI 只认这个。

async function request(url, options = {}) {
	const res = await fetch(url, options);
	const text = await res.text();
	let data = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = null;
	}
	if (!res.ok) {
		throw new Error(data?.error || `请求失败（${res.status}）`);
	}
	return data;
}

export const api = {
	listPosts: () => request('/api/posts').then((d) => d.posts),

	readPost: (slug) => request(`/api/posts/${encodeURIComponent(slug)}`).then((d) => d.post),

	createPost: (payload) =>
		request('/api/posts', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload),
		}).then((d) => d.post),

	savePost: (slug, payload) =>
		request(`/api/posts/${encodeURIComponent(slug)}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload),
		}),

	uploadAsset: (file, kind = 'post') =>
		request(`/api/assets?kind=${kind}&name=${encodeURIComponent(file.name || 'image.png')}`, {
			method: 'POST',
			body: file,
		}),
};
