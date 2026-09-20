# 出包魔法师封面 · v4「围坐龙主场版」提示词

> 模型：**GPT Image · 2.5**（全新生成）｜宽高比 **16:9**｜参考图：`refs/` 下四张常服图
> 前版：`prompt-v3-围坐收敛版.md`，出图 `abracadawhat-cover-v3-收敛版.jpeg`。
> v3 战果：**AI 味确实压下去了**（平色 / 描线 / 留白都对）——但戏剧性一起被压没了：
> 龙缩成背景里一缕白烟、全员礼貌端坐、表情轻微，画面"太平淡"。
> v4 原则：**风格段的收敛全部保留，让"龙"重新当主角**——玉绿色、🐉 emoji 的造型语言、
> 实心、大、正在咆哮；戏剧性靠"龙的到来掀起的风"（发丝衣物、飞牌、骰子）画出来，
> 而不是靠光效叠加。另修 v3 三处执行走样：座位按发色+**服装**双锚、
> 牌扇朝镜头的一面必须是**牌面**、相机钉死 30° 俯视。
> **提示词已压缩到 10000 字符以内**（出图框限制）——直接复制下面代码块，只删了冗余，硬规则一条没丢。
> 用这张的出图：`abracadawhat-cover-v4-龙主场版.jpeg`（2026-09-20 出图）。
> **判定：两项主诉求达成**——画面不平淡了（风起、全场大动作）、龙是绿色 🐉 系东方龙且实心够大；
> 风格仍是平色赛璐璐，没有回退到 v2 的 AI 味。
> **剩余硬伤**：① 真冬与瑞希换位且真冬表情反转成惊叫（死鱼眼反差笑点没了）；② 牌扇朝镜头的
> 仍是深色牌背（签名字段没落地）；③ 瑞希没做"按牌 + 持扇"姿势；④ 满天白纸略乱；⑤ 龙偏凶，
> emoji 的"圆吻卖萌感"不足。⑥ 奏的下半身扭曲。
> **→ v4.1 补丁已出：[`prompt-v4.1-补丁版.md`](./prompt-v4.1-补丁版.md)（当前待出图）**，五个补丁：
> 真冬锁座锁表情、牌背大写禁令、奏腿部解剖、背景砍成几乎空白（用户：背景不用提示词）、龙改咧嘴笑吼。

```
TASK
One 16:9 landscape illustration for a party card game: four girls playing a magical card game at a round table in a bright workshop, at the exact moment the pink-haired girl summons an Ancient Dragon from her card and its arrival stirs the room.

Two hard requirements at once:
1. STYLE — flat, matte, hand-drawn: a printed manga colour page or a 2010s TV anime frame. NOT glowing glossy AI fantasy art.
2. DRAMA — the dragon is the climax: large, close, jade-green, mid-roar, designed like the 🐉 emoji; the girls' reactions are big theatrical manga acting. A polite tea-party mood is a failure.

COMPOSITION — A REAL SEATED CARD GAME, NOT A GROUP PHOTO
- Camera clearly above the table, tilted down about 30 degrees, looking across the tabletop: the elliptical table and its receding perspective must be obvious. Never eye level.
- Four players sit around a round table. The near player is seen from BEHIND, her back and shoulders filling the lower foreground, LARGE, cropped by the bottom edge.
- The three far-side players sit on a receding arc (centre one farthest), heads at three clearly different heights — never one horizontal line.
- Nobody in a row facing the camera; a group-photo arrangement is wrong.

THE FOUR CHARACTERS — anchor each seat by hair AND outfit
1. NEAR SIDE, from behind — short dark grey-brown bob, dark green shirt with a black ribbon tie, brown plaid skirt. The dragon lunges at her: chair tipping back, body arched AWAY from the table, both hands thrown up, her card fan slipping with two or three cards leaping out, head twisted back over her shoulder, eyes wide, mouth open mid-yelp.
2. FAR CENTRE — pink hair in one large side ponytail, white blouse, pink suspender skirt. Protagonist. She has just slammed the dragon card face-up: LEFT palm still flat on that card; RIGHT hand holds her own card fan against her chest, faces toward camera. No raised arm. Half-risen, leaning forward, hair blown back, eyes shut in delighted arcs, mouth wide open in a triumphant shout.
3. FAR LEFT — long straight pale silver-blue hair, navy track jacket over a purple top. Scrambling back, gripping the table edge, eyes wide, mouth a small "o". Startled, not frightened.
4. FAR RIGHT — dark purple HIGH PONYTAIL with a light beige-gold scrunchie, clearly visible (never loose, never a bun), loose white cardigan. THE ONLY CALM ONE: half-lidded eyes down at the table, one eyebrow a fraction up, mouth one short flat line, no smile, no shock — while everything else moves, her hair barely stirs.
- Follow each reference's eye shape exactly; four distinct face templates; youthful teenage proportions, not adult women.

REFERENCE IMAGES
Four attached casual-outfit references, one per character: authoritative for face, eye colour, hair, hairstyle and clothing. Match each girl to her own reference only; do not blend features or move seats. Casual clothes only — no stage costume, idol outfit, school uniform, armour, straps or harnesses. The references are T-pose model sheets with blank faces: do NOT copy that pose or expression; use the poses above; everyone is seated.

THE ANCIENT DRAGON — THE CLIMAX, IN THE DESIGN LANGUAGE OF THE 🐉 EMOJI
- A SOLID, OPAQUE jade-green Eastern dragon, its serpentine body growing straight out of the face-up dragon card under the protagonist's palm, coiling up behind the far-side players toward the window.
- Design: the 🐉 emoji translated into the girls' flat cel style — rounded blunt snout, short pale cream horns, long flowing white whiskers, big bright eyes, wide toothy grin, pale cream belly, jade-green scales as flat colour blocks with ONE darker shadow tone and clean outlines. Playful-fierce, like the emoji come to life — never horrific, never a realistic monster.
- LARGE and CLOSE: its head about as long as a girl's torso, arcing over the centre of the table beside the protagonist, mouth wide open in a triumphant roar, mane and whiskers whipped by its own arrival, coils tense mid-motion.
- Its arrival blows through the room: hair and clothes stream away from it, two or three loose cards and the dice are knocked spinning into the air. Draw the drama through this wind and the acting, not through light effects.
- One thin ribbon of green light connects the summon spot to the dragon's chest.
- It must not cover any face, and must not cover her left hand on the card. Its head may approach the top edge but must not be cropped.

LIGHT BUDGET (HARD RULE)
Exactly two glowing things: (1) the summon spot — the face-up dragon card lying inside a faint etched magic circle at the table's centre; the card, the circle and a few small green sparks right there may glow; (2) the thin ribbon of light from that spot to the dragon's chest. The dragon's eyes may shine faintly. Everything else is matte daylight. At most THREE small impact dashes tight around the dragon's head — no other marks, speed lines or sparkles anywhere.

THE GAME'S SIGNATURE — EVERY HAND'S CARDS FACE THE CAMERA
You see everyone's cards except your own: the side of every fan facing the CAMERA shows card FACES (a coloured medallion on a light panel); the amber-brown backs face the players. All four fans follow this rule; never show dark backs to the camera. Cards: portrait rounded rectangles; eight pictograms only — dragon, ghost, heart, owl, storm cloud, snowflake, flame, potion bottle; no lettering or numbers anywhere. On the table: the dragon card in its circle, ONE other face-up card, ONE face-down stack, and a row of small matte candy-pink heart tokens per player (near player two, others five or six). The dice are mid-tumble in the air, two or three loose cards blown off the fans. Nothing else on the table.

HANDS: correct natural proportions — a modelled palm, separated fingers, a visible thumb; no splayed flat palms, no shapeless hands.

SETTING — QUIET BRIGHT WORKSHOP
A plain pale cream-lavender wall, one window with daylight, wooden shelves mostly EMPTY — at most eight small objects on all shelves combined, with wide gaps between them. No clutter, no hanging plants, no patterned wallpaper. The background stays lighter, quieter and less saturated than the characters. Not dim, not night, not a lounge.

STYLE — FLAT ANIME CEL, MATTE, HAND-DRAWN
Clean uniform warm-dark line art around every form; flat base colours; shadows as hard-edged cel shapes in one darker tone per material; no gradients, no airbrushing. Hair: flat shapes with two or three crisp highlight wedges, allowed to stream in the wind while staying flat. Skin flat, one soft shadow tone. Palette: slightly muted mid-tones; saturated accents only on the jade dragon, the amber cards and the pink hair.
FORBIDDEN: bloom; glow beyond the permitted spots; volumetric light; god rays; lens flare; bokeh; depth-of-field blur; film grain; vignette; glossy highlights; 3D or painterly rendering; particles; mist; smoke; embers; speed lines; sparkles; star flashes; energy auras; floating magic circles.

FRAMING
Every face fully inside the frame; only the near player's back may be cropped by the bottom edge. No chibi or mini versions. No fifth person, animal or mascot.

TEXT
No letters, numbers, words, logos, watermarks or captions anywhere — not on cards, walls or book spines. No speech bubbles or sound-effect lettering.
```

## 相对 v3 改了什么（v3 出图诊断 → v4 对策）

| v3 出图的问题 | v4 的对策 |
|---|---|
| 画面平淡（用户判定） | 开篇加 DRAMA 硬要求"礼貌下午茶 = 失败"；戏剧性来源改为**龙的到来掀起的风**——发丝衣物流向、飞牌、骰子空翻，全是"画出来的运动"而非光效叠加 |
| 龙是白色烟雾、又小又远 | 龙段整段重写：玉绿色、**🐉 emoji 的造型语言**（圆钝吻部、奶白短角、长白须、亮眼咧嘴）、实心不透明、头约一个少女躯干长、贴桌咆哮 |
| 表情普遍轻微 | 四个反应全加大演技：绘名连人带椅后仰+牌飞出；奏扒桌沿后缩；瑞希半起身按牌；真冬"全场只有她的头发不动"——反差当笑点 |
| 人物座位漂移（奏跑近侧） | 座位锚定从"只写发色"升级为**发色 + 服装双锚**（绘名墨绿衬衫黑领结、奏藏青外套），明写"不得换座位" |
| 牌扇朝镜头的是牌背 | 签字段重写：镜头一侧必须是**牌面**（彩色圆章），牌背朝玩家自己 |
| 相机掉到平视 | 明写"桌面椭圆与透视必须明显，不许掉到平视"，近侧背影重新强调 LARGE |
| 光效预算执行良好（保留） | 预算维持两处；召唤点允许"法阵图案 + 少量绿色火花"并入第一处；龙头 ≤3 个强调符号；**烟雾/白雾入 FORBIDDEN**（v3 白烟龙的教训） |

## 出图后自检清单

- [ ] 龙是玉绿色、🐉 emoji 造型（圆吻/奶白角/长须/亮眼咧嘴）、实心、头 ≥ 半个少女躯干、贴桌咆哮
- [ ] 戏剧性来自风：四人的头发衣物都在被吹、空中有飞牌和骰子；真冬的头发几乎不动（笑点）
- [ ] 发光仍是两处（召唤点含法阵 + 连接光带）；龙头 ≤3 个强调符号；无烟雾/景深/颗粒
- [ ] 座位对号：近侧=绘名（墨绿衬衫黑领结）、中=瑞希、左=奏（藏青外套）、右=真冬（高马尾米金发圈）
- [ ] 四扇牌朝镜头的一面是**牌面**（彩色圆章），无深色牌背对镜头
- [ ] 表情四大区别：绘名惊叫后仰、瑞希闭眼大笑、奏扒桌小"o"、真冬零反应挑眉
- [ ] 相机 30° 俯视（桌面椭圆明显）、近侧背影 LARGE；脸是少女比例、四张脸不同模板
- [ ] 无文字/无 chibi/无第五人

## 如果 v4 龙又跑偏

🐉 emoji 锚定若不奏效（例如画出西方龙），把 Dragon 段里的
"in the design language of the 🐉 emoji" 换成
"a cute-mascot Eastern dragon like the dragon emoji sticker: round green head, cream horns and whiskers, toothy grin"——
"emoji sticker" 措辞对贴纸化造型的牵引更强。

## 长度

英文提示词（代码块）已压缩到 **10000 字符以内**以适配出图框限制；压缩只删了跨段落重复与过渡句，
硬规则（光效预算 / 座位双锚 / 牌面朝镜头 / FORBIDDEN 清单 / 🐉 造型）一条没丢。
改提示词后跑一遍 `python -c` 数一下代码块字符数再交付。
