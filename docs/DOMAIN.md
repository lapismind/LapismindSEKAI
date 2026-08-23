# 域名规范

> 所有项目统一使用 qmzhj.top 及其子域名部署，不使用 workers.dev 默认域名。

## 规则

1. 每个项目的 Cloudflare Worker 部署后，必须绑定 `<project-name>.qmzhj.top` 子域名。
2. 子域名格式：项目名小写、短横线分隔。例如：
   - showhand → `showhand.qmzhj.top`
   - 海龟汤（turtle-soup）→ `turtlesoup.qmzhj.top`
   - 未来新项目 my-game → `mygame.qmzhj.top`
3. 不使用 workers.dev 地址对外分享或写进文档。

## 配置方法

在 wrangler.toml（或 wrangler.jsonc）中添加 routes：

```toml
routes = [
  { pattern = "showhand.qmzhj.top", custom_domain = true }
]
```

Cloudflare 会自动创建 DNS 记录和证书，无需手动操作。

## 已绑定域名

| 项目 | 域名 |
|------|------|
| showhand | showhand.qmzhj.top |
| abracadawhat | abracadawhat.qmzhj.top |

## 新项目接入步骤

1. 部署 Worker：`npm run deploy`
2. 在 wrangler 配置中添加上述 routes 条目
3. 重新 deploy，确认输出中出现自定义域名
4. 浏览器访问验证 HTTPS 正常

