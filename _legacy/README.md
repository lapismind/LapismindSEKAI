# _legacy/ — 用完即弃的一次性脚本

按根 `AGENTS.md` 的目录约定，一次性脚本用完移到这里，不留在 `blog/scripts/` 与 `docs/agent/scripts/`。

## oshi-card-figure-slot/ — 作废方向：把人物当"贴图"塞进卡片的槽位

2026-09-20 ~ 09-21 的做法是：卡片自己用 CSS 画水、画浪、画造景，留一个
`.oshi-figure` 槽位等人物的透明底立绘到货，再由版式决定人物多大、站哪儿。

**这个方向被否了。** 用户定的是反过来：**图是最高优先级，版式从图里量出来**，
所以最终改成整图铺底（见 `blog/src/pages/about.astro` 的 `.oshi-card`）。
这几个脚本全都依赖已经删掉的 `.oshi-figure` / `.oshi-above` / `.oshi-below`，
今天跑不起来，只作为"当时怎么想的"留档。

- `gen-oshi-preview.py` — 按真实页宽渲染独立预览页，把试位图放进 `.oshi-figure`
- `playwright-oshi-figure-mock.py` — 用占位剪影验证头/肩/马尾的几何
- `playwright-oshi-zindex-probe.py` — 查水层渐变有没有盖住她（当时的 z-index 坑）
- `playwright-oshi-geometry.py` — 量卡片里文字的实际墨迹边界

## oshi-card-mocks/ — 同期的版式/配色样张脚本

把文字与图片用 PIL 直接合成出卡片样张，用来对比配色与人物位置。同样属于
"拿版式约束图"的思路，作废。

- `mock-card.py` / `mock-card2.py` / `mock-card3.py` / `mock-card-final.py` — 卡片版式迭代
- `mock-gpt.py` — 把 GPT 出的两张图合成进卡片
- `mock-palette.py` / `mock-palette2.py` — 卡片水色往画作色相靠的试验

当时的结论仍然有效、已经用在成品里的一条：**画风与水色打架的根因是饱和度而不是色相**
（`saturate()` 能救），但最终没有采用调色，而是让整张图直接成为卡面。

现在的替代品是 `blog/scripts/` 下的三个脚本（量图 → 探框 → 出样张），
以及 `docs/agent/scripts/playwright-oshi-card-check.py`（实机几何复核）。

## 追记：`oshi-card-figure-slot/gen-oshi-preview.py` 已被取代

那个预览页依赖已经删掉的 `.oshi-figure` / `.oshi-above` / `.oshi-below`，跑不起来。
**现在的预览是 `blog/scripts/gen-oshi-preview.py`** —— 生成一份自包含（图与字体内联、
双击即开、脱网可用）的 `docs/agent/scripts/out/oshi-preview/index.html`，
亮暗两张卡同页、带滚动驱动的水面波动与 `--slosh` HUD。
与这里这些脚本的区别是：它只做装配（markup/CSS/脚本/令牌/字体/图片全从真源抽），不写第二份。
