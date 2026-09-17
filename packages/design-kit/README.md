# @lapismind/design-kit

LapismindSEKAI 的**设计语言通用件**：品牌色阶、浅色表面令牌、基础样式、字体接入。

设计语言的唯一真源。博客与各游戏的配色/字体/圆角/阴影都从这里来，**不要在项目里重写这些令牌**——同一份值抄在多处，改一次要改 N 个地方，而且必然漏掉一个。

---

## 消费方式

**Tailwind 项目（Vue + Vite）**

```css
/* src/styles/global.css */
@import "tailwindcss";
@import "@lapismind/design-kit/tokens.css";  /* CSS 自定义属性 */
@import "@lapismind/design-kit/theme.css";   /* 品牌色阶 → 生成 bg-brand-* 等工具类 */
@import "@lapismind/design-kit/base.css";    /* 底色/字体/面板/焦点/动效降级 */
```

装依赖：

```bash
npm install @lapismind/design-kit@file:../packages/design-kit
```

**非 Tailwind 项目（Astro 博客）**

只引 `tokens.css` + `base.css`，然后用 `var(--page-bg)` 这类自定义属性。不要引 `theme.css`（它的 `@theme` 只有 Tailwind 认）。

---

## 色板

主色 `#8888CC`，代表色。色相集中在 `--hue-accent: 283`，其余表面色/文字色都由它按固定偏移推导——**换主色只需要改这一个数字**。

| 用途 | 令牌 | 值 | 实际 hex |
|---|---|---|---|
| 页面底 | `--page-bg` | `oklch(0.972 0.014 249)` | `#EFF7FF` 极浅冷调白 |
| 更淡一档底 | `--page-bg-deep` | `oklch(0.955 0.02 249)` | `#E6F2FD` |
| 卡片（可半透明） | `--card-bg` | `oklch(0.995 0.005 249)` | `#FBFEFF` |
| 卡片（实白） | `--card-solid` | `#FFFFFF` | `#FFFFFF` |
| 标题/重点 | `--ink` | `oklch(0.25 0.028 250)` | `#17232F` |
| 正文 | `--ink-soft` | `oklch(0.42 0.03 245)` | `#404F5D` |
| 辅助说明 | `--muted` | `oklch(0.55 0.03 240)` | `#627482` |
| 1px 发丝边 | `--line` / `--line-strong` | `oklch(0.9 0.012 249)` / `oklch(0.82 0.02 249)` | `#D8DFE6` / `#BBC5D1` |
| 品牌色（文字/图标） | `--primary` | `oklch(0.52 0.12 283)` | `#605EAB` |
| 品牌装饰/光晕 | `--primary-brand` | `oklch(0.654 0.1 283)` | `#8888CC` |
| 浅色填充块 | `--primary-soft` / `--primary-ghost` | `oklch(0.93 0.03 283)` / `oklch(0.965 0.02 283)` | `#E4E6FC` / `#F1F2FF` |
| 品牌渐变 | `--gradient` | `linear-gradient(120deg, 紫 → 粉紫)` | — |
| 危险/错误 | `--danger` / `--danger-soft` / `--danger-line` | `oklch(0.52 0.19 27)` / `oklch(0.96 0.025 27)` / `oklch(0.86 0.055 27)` | `#B0311F` 系 |

> **危险色为什么不跟 `--hue-accent` 走**：出错在任何色相下都该是红，跟着主色变会失去警示含义。
> 加它之前三个游戏里散着 8 种不同的红（`red-300/400/500/600/900`），join 卡片与提示条的颜色因此各不相同。

> **页面底为什么是"极浅冷调白"而不是明显的香芋紫**：`--hue-bg = hue_accent - 34°`，从紫（283）往冷的方向走了 34 度落进蓝区。这是本站的既有观感（博客就是这个底色），香芋紫的存在感由品牌色、渐变与卡片承担，页面底只负责"干净"。调这个偏移量能整体改冷暖，但会同时影响博客与所有游戏。

Tailwind 工具类档位（`theme.css`）：`brand-50 … brand-950`，其中 `brand-500 = #8888CC`、`brand-600 = #7676B8`。

### 语义颜色类（写组件时优先用这一组）

`theme.css` 用 `@theme inline` 把上面的自定义属性暴露成按**角色**命名的 Tailwind 色，值跟着 `data-theme` 自动切换：

| 用途 | 类 | 指向令牌 |
|---|---|---|
| 页面底 / 卡片 / 实卡片 | `bg-page` / `bg-surface` / `bg-surface-solid` | `--page-bg` / `--card-bg` / `--card-solid` |
| 表单字段、分段控件底槽 | `bg-field` | `--field-bg` |
| 抬起表面（提示条、浮起小片） | `bg-raised` | `--surface-raised` |
| 半透明顶/底栏（配 `backdrop-blur`） | `bg-chrome`（可用 `/80`） | `--glass-bg` |
| 模态遮罩 | `bg-overlay` | `--overlay` |
| 文字三级 | `text-ink` / `text-ink-soft` / `text-muted` | `--ink` / `--ink-soft` / `--muted` |
| 压在亮色芯片上的文字 | `text-on-accent` | `--on-accent` |
| 1px 描边 | `border-line` / `border-line-strong` | `--line` / `--line-strong` |
| 中性（非品牌）按钮 | `bg-neutral` / `hover:bg-neutral-hover` | `--btn-neutral` / `--btn-neutral-hover` |
| 危险/错误 | `text-danger` / `bg-danger-soft` / `border-danger-line` | `--danger` / `--danger-soft` / `--danger-line` |

悬停变体与 `/NN` 透明度修饰符都能用（`hover:bg-surface`、`bg-chrome/80`）：`@theme inline` 会把 `var()` 原样保留进产物、不预先求值，所以主题切换对工具类同样生效（2026-09-15 在 Tailwind 4.3.3 上实测确认）。

> **为什么品牌色阶用普通 `@theme`、语义层却用 `@theme inline`**：普通 `@theme` 要求静态值，写成 `var()` 会在构建期被固化成当前主题的值，切换主题就失效；而品牌 11 档是人工排布、不随主题变，正好该用静态 hex。**判断标准是"这个值要不要跟着主题走"**：要，用 `inline` 并指向 `tokens.css`；不要，用普通 `@theme` 写死。

组件里请写 `bg-surface` 这类语义类，**不要**写 `bg-[var(--card-bg)]`，更不要写死 hex——后两者一个冗长、一个换主题就失效。

> **两处定义必须同步**：品牌色阶在 `theme.css` 里是静态 hex，在 `tokens.css` 里是 oklch 推导。`tests/tokens.test.mjs` 会校验二者色相一致——改主色时两处一起改，跑 `npm test` 确认。（语义颜色层不受这条约束：它的值指向 `tokens.css`，不构成第二份真源。）

深色主题（`--hue-accent` 同源推导）在 `tokens.css` 的 `:root[data-theme='dark']` 里，按需 opt-in：在 `<html>` 上打 `data-theme="dark"` 即生效。博客用 JS 切换亮暗；**自带深色身份的项目（如 turtle-soup）常驻深色，直接把该属性写死在 HTML 上**，不需要主题切换 UI。

---

## 层次规则

**白卡浮在浅底上，靠描边 + 阴影做层次，不靠深色遮罩。**

阴影阶梯（`--shadow-sm/md/lg`）承担层级：

| 层级 | 用法 |
|---|---|
| `--shadow-sm` | 普通面板、席位卡 |
| `--shadow-md` | 卡牌、抬起的元素 |
| `--shadow-lg` | 浮层、弹窗、当前态强调 |

**禁止**：

1. **深色底 + 白字**的输入框/提示条（白底深字，或浅色填充 + 品牌色字）。
2. 用 `bg-black/70` 这类重遮罩压背景——白卡加柔影就够。（模态需要聚焦时用极浅遮罩，不要纯黑。）
3. 在项目里硬编码品牌色 hex。要新档位就往 `theme.css` 加，不要散落在组件里。

**允许**：游戏元素本身可以有对比强的深色。牌背、筹码这类"物件"的固有色不受限制（扑克牌背本来就是深的），受限的是 UI 组件。

---

## 圆角与触摸目标

| 令牌 | 值 | 用途 |
|---|---|---|
| `--radius-sm` | 10px | 小控件、徽章容器 |
| `--radius` | 18px | 面板、席位卡 |
| `--radius-lg` | 26px | 大卡片、弹窗 |
| `--tap-min` | 44px | 可点击元素的最小边长（手机） |

胶囊（`border-radius: 999px`）用于标签、状态徽章、计数。

---

## 动效

基调是**"柔和、几乎察觉不到"**。所以这里只给一条缓动曲线和四档时长，各项目不要再自己写数字——否则全站会出现七八种节奏，看起来就是"没设计过"。

| 令牌 | 值 | 用途 |
|---|---|---|
| `--ease-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | 默认。收尾平滑、无回弹，适合位移与淡入 |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 起步略快、收得更缓，适合"展开/生长"（进度条、装饰线） |
| `--dur-tap` | `0.15s` | 点按反馈 |
| `--dur-fast` | `0.22s` | 悬停、颜色变化 |
| `--dur-base` | `0.35s` | 状态切换（主题、面板开合） |
| `--dur-slow` | `0.7s` | 入场、图片淡入 |
| `--stagger` | `70ms` | 列表逐项入场的间隔 |

**阈值**（做动效前先对照，超过就得有理由）：位移 ≤ 6px、缩放 ≤ 3%，只动 `opacity` / 小位移 / 颜色 / 阴影。**不做**回弹、旋转、超过 6px 的位移。

### 入场基元（`base.css`）

| 类 | 作用 |
|---|---|
| `.reveal` | 元素自身淡入上升。JS 观察到进入视口后加 `.is-visible` |
| `.reveal-stagger` | 容器；直接子元素按 DOM 顺序依次入场，顺序由 JS 写 `--reveal-index` |

两条硬性要求，**不是可选项**：

1. **必须有 `html.has-js`**。入场元素的初始态是 `opacity: 0`，脚本没跑起来就永久不可见——静默失败里最难发现的一种。所以在 `<head>` 内联脚本里先 `document.documentElement.classList.add('has-js')`，CSS 才会隐藏。没脚本 = 直接是最终态。
2. **`prefers-reduced-motion` 下给最终态**，不是"把时长压到 0"——后者会退化成"滚到才有内容"。`base.css` 已统一处理。

列表超过 4—6 项就别整组错峰了（总时长会变成"等动画"），按可见行分组，只错峰首屏那几条。

---

## 字体应用规则

这是最容易做错的一环，**中文正文与数字用两套栈**：

| 场景 | 用 | 原因 |
|---|---|---|
| 中文标题/正文/按钮/说明 | `--font-body`（霞鹜文楷 Screen） | 与站点手写感一致；这是"一眼看出是同一个站"的主要来源 |
| 筹码数、房间码、倒计时、卡牌点数、坐标、任何要竖向对齐的数字 | `--font-mono` + `.font-num` | 楷体的数字在小字号下辨识度差、宽度不等，牌面数字会歪 |

`.font-num` = `font-family: var(--font-mono); font-variant-numeric: tabular-nums`。

字体栈里 `LXGW WenKai Screen` 之后跟着 `'Atkinson', system-ui, …` 是**逐级兜底**：字体没加载出来时也不能掉成衬线体。

### 字体资产

5.2MB 的 woff2 子集**不进 git**，唯一真源在 `packages/design-kit/fonts/`（与 chat-kit 对 `emojis/` 的处理一致）。消费方在 dev/build 前同步到自己的 `public/fonts/`，并把该目录 gitignore：

```json
"scripts": {
  "predev": "node ../packages/design-kit/scripts/sync-fonts.mjs",
  "prebuild": "node ../packages/design-kit/scripts/sync-fonts.mjs"
}
```

```html
<link rel="stylesheet" href="/fonts/lxgwwenkaiscreen.css" />
```

CSS 里是 97 个按 `unicode-range` 切分的 `@font-face`，**浏览器只下载页面实际用到的那几个子集**，不是一次拉 5MB。

> 为什么必须拷贝、不能直接引用包路径：Vite/Astro 只把项目的 `public/` 按原路径静态托管，`@font-face` 的 `url()` 是运行时请求，必须落在可访问的路径上。

---

## 新增一个项目的接入步骤

1. `npm install @lapismind/design-kit@file:../packages/design-kit`
2. 在 `src/styles/global.css` 里按上面的顺序 `@import`（Tailwind 项目再加 `theme.css`）
3. 在 `package.json` 加 `predev` / `prebuild` 同步字体，`index.html` 加 `<link>`
4. 项目 `global.css` **只留应用外壳**（`html/body/#app` 高度、`overscroll-behavior`、整页排版尺度这些布局级设置），设计令牌一律不重写
5. 组件里优先用**语义颜色类**（`bg-surface` / `text-ink` / `border-line` …，见上方对照表），品牌强调用 `bg-brand-*` / `text-brand-*`；确实需要非工具类的色值才走 `var(--*)`。**不要写死 hex。**
6. **深色项目**：在 `<html>` 上加 `data-theme="dark"`，表面/文字/描边自动取深色档。**不要再自己声明一套深色表面色**——那正是 turtle-soup 2026-09-15 收敛掉的东西（它当时把 `#1c1c33` 等写在自己 CSS 里，与 design-kit 脱节）。

## 自检

```bash
cd packages/design-kit && npm test
```

校验：必需令牌齐全、`theme.css` 与 `tokens.css` 的色相一致、字体子集文件与 CSS 里的引用一一对应（防止同步了一部分）。
