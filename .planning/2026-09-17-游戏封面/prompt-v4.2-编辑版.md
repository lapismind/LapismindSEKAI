# 出包魔法师封面 · v4.2「图生图编辑版」提示词

> 模式：**GPT Image 图生图编辑**（用户发现可以接着上张图改）——基底：`abracadawhat-cover-v4.1-补丁版.jpeg`
> 前情：v4.1 出图的构图 / 戏剧性 / 绿色实心龙 / 平涂风格全部合格，但五个补丁一个没落地
> （真冬尖叫、牌背朝镜头、纸页漫天、龙偏凶、背景未简化）。
> 整张重骰会把合格的部分一起丢掉，所以改用**外科手术式编辑**：只改病灶，其余锁死。
> 用这张的出图：`abracadawhat-cover-v4.2-编辑终版.png`（2026-09-20 出图，**编辑五条全部落地**：
> 真冬死鱼眼持牌扇、牌面圆章朝镜头、纸页清空、龙圆润化、背景安静；方图 1024×1024 已归档本目录）。
> **判定：用户验收通过，已接入 blog**。接入要点：方图直接铺进列表位会变成 1100px 高的巨块
> （另两张封面是 2:1 / 16:9），故按实际显示尺寸做了 16:9 裁切（保留龙头 + 四脸 + 法阵，
> 弃顶部盘身与底部椅背）→ `blog/src/assets/covers/abracadawhat-cover.png`，列表页与详情页 hero 共用。

## 编辑提示词（直接复制，配基底图一起喂）

```
Edit this image. Keep the composition, the camera angle, all four characters' positions and outfits, the round table, the green dragon's pose and body, the flat matte anime-cel style and the colour palette exactly as they are. Change ONLY the following:

1. The purple-haired girl with the high ponytail (centre): replace her screaming expression with complete deadpan calm — half-lidded eyes looking down at the table, one eyebrow raised a fraction, mouth a short flat line, no smile, no shock, no sweat drops. Lower her hands: one rests on the table edge, the other holds her card fan lazily at chest height. Her hair barely moves. She is the only calm person in the picture.

2. Turn every fan of cards so its LIGHT FACE points toward the camera: each visible card face is a light panel with one simple coloured medallion icon in the upper part — icons only, choose from: a dragon, a ghost, a heart, an owl, a storm cloud, a snowflake, a flame, a potion bottle. No lettering or numbers. Dark navy card backs must never face the camera.

3. Remove all flying white paper sheets and book pages. Keep only a few loose playing cards in the air, plus the dice.

4. Make the dragon's head friendlier, in the design language of the 🐉 emoji: rounded blunt snout, a wide-open smiling roar showing a few rounded teeth instead of long fangs, big bright playful eyes, long flowing whiskers. Same pose, same body, same solid jade-green flat cel shading. It should read as playful-fierce, not monstrous.

5. Simplify the background: replace the shelves, curtain and edge clutter with a plain pale cream-lavender wall and one simple window; remove the small manga marks floating near the characters' heads. Keep the spilled teacup and the cards blowing in the wind.

Do not change anything else: same poses for the other characters, same outfits, same magic circle etched in the tabletop, same matte daylight with only the summon spot glowing, same flat hand-drawn cel style with hard-edged shadows and clean warm-dark line art. No letters, numbers, logos or watermarks anywhere.
```

## 与 v4.1 提示词的策略差异

- **不再重骰**：整张重新生成会连合格的构图 / 龙身 / 风格一起丢；编辑模式只动病灶，成功率按条算。
- **座位完美主义放弃**：真冬在中间、瑞希在右边与规格相反，但把两个人**换座位**属于大范围重绘，
  编辑模式风险极高。改为只把真冬的表情改成死鱼眼——笑点的本质是"全场唯一的静"，不是她的座位。
  瑞希高举龙牌（牌面朝镜头）比规格里的"按牌 + 持扇"更直白，顺势保留。
- **编辑词刻意短**（约 2000 字符）：编辑模式下模型以基底图为真源，过长的世界描述反而把它往重绘推。

## 编辑后自检清单

- [ ] 紫发高马尾（真冬）死鱼眼：半睁眼下看、一条眉略抬、嘴一条平线、手里懒洋洋持扇
- [ ] 所有牌扇朝镜头的是**牌面**（彩色圆章），无深色牌背
- [ ] 空中无白纸书页，只有几张卡牌和骰子
- [ ] 龙头改圆润笑脸（圆吻、圆牙、亮眼神），身体姿势未变
- [ ] 背景边缘的架子 / 窗帘 / 头顶小符号已清掉；茶杯翻洒保留
- [ ] 其余一切没动：绘名背影后仰、瑞希举龙牌、奏的姿势、桌面法阵、平涂风格、单点发光

## 长度

编辑提示词实测 **2067 字符**（≤10000）。改完跑一遍字符计数再交付。
