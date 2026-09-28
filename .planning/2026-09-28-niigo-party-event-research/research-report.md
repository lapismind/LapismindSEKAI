# niigo-party 事件格与梗卡素材调研

**调研日期：2026-09-28**

> **阶段草稿，尚待最终审阅。** 时间截点为 2026-09-28。日服当前可核对的最新已收录活动为 #218「Connect to SEKAI！」；活动资料和故事路由已找到，但正文/角色出场未核实。英语服同期活动为 #180「Wishes in Bloom!」，不能把它写成跨服务器最新。剧情覆盖与候选梗还需复核，不作为已定设计或实现依据。

## 研究范围与限制

时效性审计另核对了 #179、英语服 #180 与日服 #218；这几项补足“截至日期最新信息”的服务器差异，但不属于逐话深读样本。

以用户指定的 [Moesekai 25点主线索引](https://pjsk.moe/zh-cn/story/unit/6/) 和 [活动剧情索引](https://pjsk.moe/zh-cn/story/event/) 为入口，核对了 25点主线的 21 个章节标题，并挑选能说明成员关系、跨组合往来或重复地点的活动故事深读。重点活动包括 #2、#4、#7、#58、#72、#117、#141、#145、#150、#177；这是一份重点清单，不是全量活动目录。活动索引由前端加载，当前检索也未能把所有与 25点人物有关的活动逐一筛完。

叙事事实以 Moesekai 上的游戏内剧情镜像为主，角色身份和组合背景用 [SEGA 官方角色页](https://pjsekai.sega.jp/character/unite05/index.html)交叉核验。Moesekai 自述为粉丝制作的非商业资料库；它提供剧情材料，但不是官方发布渠道。部分简中剧情页只显示“正在加载剧情…”，另有章节明确提示剧情 asset 尚未镜像。遇到这类章节时，本报告只引用可确认的章节标题/活动资料，并把社区转述单列，避免将转述写成原文事实。

社区热度仅按页面可见的日期、票数、播放量等指标描述。不同平台的数字不能直接比较；一次高互动也不足以代表全体玩家。找不到多个可核对的讨论或互动数据时，标为“有讨论，热度未验证”或“未找到可靠热度指标”。

## 近期性审计（截至 2026-09-28）

以下网页与公开互动数于 **2026-09-28** 查看。活动编号在不同服务器的发行时间并不相同，不能把同一活动的日服年份和英语服年份混用。

| 范围 | 截止日可核对内容 | 对本报告的影响 |
|---|---|---|
| #177「向无法解开的明天伸手 / Tying Tomorrow’s Ribbon」 | Moesekai 日文版活动页标日服 2025-08-22 至 08-28；英语版标 2026-08-22 至 08-29。英语服官方公告列出 PT/UTC 时段与奏、真冬、绘名、瑞希活动卡。中文版活动页标 2026-08-22 至 08-28，但该页基础信息没有明示服务器；因此以日文版页和英语官方公告区分版本。[日服活动页](https://pjsk.moe/ja-jp/events/177/)、[英语服资料页](https://pjsk.moe/en-us/events/177/)、[英语服官方公告](https://www.colorfulstage.com/news/detail/001132.html)、[简中活动页](https://pjsk.moe/zh-cn/events/177/) | 在本轮已核验的可读样本中，#177 是最近一篇 25时四名人类成员共同参与的本组活动故事。目录列 8 话；第1话正文可读，第7话页面明确写着 `event_tomorrow_2025/scenario/event_177_07.json` 未收录。此轮没有逐话读完 8 话，不能把第1话当成整篇梗概；后续 #218 的章节正文与角色出场未验证。[8话目录](https://pjsk.moe/zh-cn/story/event/177/)、[第1话正文](https://pjsk.moe/zh-cn/story/event/177/1/)、[第7话缺档说明](https://pjsk.moe/story/event/177/7/) |
| #179「Link the Beats!」 | 英语官方公告将它列为 World Link，活动时间为 2026-09-06 至 09-18 PT，并安排六位 Virtual Singer 分章；Moesekai 剧情目录标出 15 话。[官方活动公告](https://www.colorfulstage.com/news/detail/001156.html)、[15话目录](https://pjsk.moe/zh-cn/story/event/179/) | 它晚于 #177，是跨 SEKAI 的 Virtual Singer 活动，不是 25时四名人类角色的本组活动。本轮未逐一核对 15 话出场表，故只列作跨组合/SEKAI 相关范围，不据此断言某一 25时成员在特定话登场。 |
| #180「Wishes in Bloom!」 | 英语服活动资料页显示日期 2026-09-25 至 09-28；区域对话分类页列出 10 段对话，故事正文路由本轮不可读。[活动资料页](https://pjsk.moe/en-us/events/180/)、[区域对话分类](https://pjsk.moe/zh-cn/story/area/event_180/) | 这是英语服当期活动。日服同编号较早举办；不可把 #180 写成所有服务器的最新活动。 |
| #218「Connect to SEKAI！」 | 日服 World Link 最终综合篇。SEGA/Colorful Palette 公告时间为 2026-09-25 20:00 至 09-28 19:59 JST；Moesekai #214–218 页面可读活动标题/日期，#219–222 目前为通用占位。#218 故事索引结构化数据标明**全 2 话**，标题为「共にセカイへ！」和「これからは……！」；两话页面正文仍显示 Loading story，Episode 1 标签为「簡体字版」。[官方公告](https://prtimes.jp/main/html/rd/p/000007610.000005397.html)、[活动页](https://pjsk.moe/ja-jp/events/218/)、[2话故事索引](https://pjsk.moe/ja-jp/story/event/218/)、[区域对话页](https://pjsk.moe/ja-jp/story/area/event_218/)、[第1话](https://pjsk.moe/ja-jp/story/event/218/1/)、[第2话](https://pjsk.moe/ja-jp/story/event/218/2/) | 截至本轮检查的日服最新已填充活动条目。可报告活动日期、故事话数和标题元数据；正文与具体角色出场未实际复核。 |

因此，“最新”需要按服务器和题材口径说清：在目前已核验的可读样本中，#177 是最近一篇确认有 25时四名人类成员共同参与的本组活动；#179 是 Virtual Singer 跨 SEKAI 故事。日服截至 2026-09-28 当前可核对的最新已收录活动为 #218「Connect to SEKAI！」；英语服同期为 #180「Wishes in Bloom!」。#218 正文与具体角色出场尚未核实，活动故事全集也未穷尽筛查，不能把本段当作所有服务器、所有 25时相关故事的完整榜单。

## 25点主线故事清单

Moesekai 主线目录标示共 21 话。下列标题逐话链接到对应章节页；这份清单用于确定覆盖范围，不代表每一话都完成了逐句复读。[目录页](https://pjsk.moe/zh-cn/story/unit/6/)

| 话数 | 章节 |
|---|---|
| 00 | [序章](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_00/) |
| 01 | [午夜音乐社团](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_01/) |
| 02 | [白色的初音未来](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_02/) |
| 03 | [OWN](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_03/) |
| 04 | [我是好孩子](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_04/) |
| 05 | [消失的雪](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_05/) |
| 06 | [无人「世界」](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_06/) |
| 07 | [你们也都想抛开一切不是吗？](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_07/) |
| 08 | [平庸之人的画](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_08/) |
| 09 | [我只是想做自己而已](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_09/) |
| 10 | [凭这种旋律是不够的](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_10/) |
| 11 | [创作带来幸福的音乐](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_11/) |
| 12 | [独一无二的歌](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_12/) |
| 13 | [迷失的“自我”](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_13/) |
| 14 | [会感到寂寞的](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_14/) |
| 15 | [在自暴自弃之前](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_15/) |
| 16 | [崩溃](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_16/) |
| 17 | [两个人的诅咒](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_17/) |
| 18 | [就算是这样我也要救你](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_18/) |
| 19 | [写作悔恨的未来](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_19/) |
| 20 | [25点，Nightcord见。](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_20/) |

官方简介确认：25点是通过 Nightcord 协作的匿名音乐社团，成员起初彼此不知面貌与姓名；真冬的问题促使大家见面，成员一边面对各自的困境，一边继续创作。官方还把他们的 SEKAI 描述为安静、空旷、无机质的空间。[SEGA 组合简介](https://pjsekai.sega.jp/character/unite05/index.html) 与主线索引相互对应。主线清单可用来建立角色背景；本次深读重点落在能直接看到章节对白的活动故事上。

## 角色社交圈与主要关系

| 关系线 | 可确认的关系与作用 | 来源 |
|---|---|---|
| 25点四人 | 奏作曲、真冬作词、绘名绘制 MV 插画、瑞希制作 MV。成员起初线上匿名协作，后来因真冬的处境走到线下。 | [SEGA 组合页](https://pjsekai.sega.jp/character/unite05/index.html)、[奏资料](https://pjsekai.sega.jp/character/unite05/kanade/index.html)、[真冬资料](https://pjsekai.sega.jp/character/unite05/mafuyu/index.html)、[绘名资料](https://pjsekai.sega.jp/character/unite05/ena/index.html)、[瑞希资料](https://pjsekai.sega.jp/character/unite05/mizuki/index.html) |
| 奏—真冬 | 官方角色介绍写明，奏在察觉真冬母亲要求她离开真冬后选择继续陪伴；真冬逐渐把音乐社团视为自己的容身处。 | [奏官方资料](https://pjsekai.sega.jp/character/unite05/kanade/index.html)、[真冬官方资料](https://pjsekai.sega.jp/character/unite05/mafuyu/index.html) |
| 真冬—笑梦、穗波 | 活动 #4 体育节故事让笑梦、真冬、穗波在学校场景相遇；Moesekai 的韩文区域活动页附中文剧情概要，记载笑梦注意到真冬的笑容并非发自内心。活动 #141 又让真冬、笑梦、穗波一起筹办除草与试胆活动。前一项“假笑侦测”是对故事的概括，不是官方关系称号。 | [活动 #4 第4话](https://pjsk.moe/zh-cn/story/event/4/4/)、[活动 #4 剧情概要](https://pjsk.moe/ko-kr/story/event/4/)、[活动 #141 第5话](https://pjsk.moe/en-us/story/event/141/5/) |
| 瑞希—类、杏、司、冬弥、彰人 | #58 的神高体育节让瑞希与类、杏合作；#72 的街头庆典故事明确让瑞希向奏介绍“初中朋友”类，并把奏、绘名介绍为自己的音乐社团伙伴。该话也让绘名与类、宁宁重逢，笑梦提起绘名教她画画。跨组合关系不是只有 25点内部互动。 | [活动 #58 剧情概要与章节](https://pjsk.moe/zh-cn/story/event/58/)、[活动 #58 第2话](https://pjsk.moe/zh-cn/story/event/58/2/)、[活动 #72 第6话（英文剧情正文）](https://pjsk.moe/en-us/story/event/72/6/)、[活动 #72 第6话（简中目录页）](https://pjsk.moe/zh-cn/story/event/72/6/) |
| 瑞希—姐姐 | #117 第3话中，瑞希和姐姐逛完多家店后在家庭餐厅休息，并回想姐姐曾为她做衣服。#177 第1话则写姐姐因工作将回日本，在涩谷开快闪店；瑞希考虑邀请成员同行。 | [活动 #117 第3话](https://pjsk.moe/zh-cn/story/event/117/3/)、[活动 #177 第1话](https://pjsk.moe/zh-cn/story/event/177/1/) |
| 瑞希—雫、真冬—其他组合朋友 | #141 第5话从真冬、笑梦、穗波的除草/试胆筹备扩展到瑞希和雫：瑞希与雫刚在缝纫休息室相处过，随后加入服装制作和活动。 | [活动 #141 第5话（英文剧情正文）](https://pjsk.moe/en-us/story/event/141/5/)、[活动 #141 简中活动页](https://pjsk.moe/zh-cn/story/event/141/) |
| 奏—一歌、穗波 | 卡牌剧情 #327 写到奏、真冬与一歌、穗波在家庭餐厅聊音乐和长发生活琐事。它能证明跨组合的日常交往素材存在，但这是卡牌剧情，不是活动故事。 | [卡牌剧情 #327「一如往常的拉面」](https://pjsk.moe/zh-cn/story/card/327/) |

## 重点主线与活动故事

活动索引超出本轮可逐话核验的范围，以下是与 25点人物、外部关系或可复用地点相关的重点样本。

| 活动 | 相关人物 | 可核验的关系/事件 | 来源与限制 |
|---|---|---|---|
| #2「被囚禁的提线木偶」 | 奏、真冬、绘名、瑞希 | 四人一起参观人偶展；展览引发真冬强烈不适，奏和其他成员开始直接接触她的困境。可作为“集体参观/展览”素材，剧情语气偏沉重。 | [活动剧情目录](https://pjsk.moe/zh-cn/story/event/2/)、[第4话](https://pjsk.moe/zh-cn/story/event/2/4/) |
| #4「奔跑吧！体育节！～组织委员晕头转向～」 | 笑梦、真冬、穗波、遥、咲希等 | 学校体育节筹备和比赛把笑梦与真冬放进同一组活动场景，穗波也参与相邻互动。该活动是“真冬×笑梦假笑”粉丝梗的重要叙事来源之一。简中第4话页可核对章节名；详细故事概要在 Moesekai 韩文区域页。 | [活动目录](https://pjsk.moe/zh-cn/story/event/4/)、[第4话「和学姐一起」](https://pjsk.moe/zh-cn/story/event/4/4/)、[Moesekai 活动概要](https://pjsk.moe/ko-kr/story/event/4/) |
| #7「神山高校校园庆典！」 | 瑞希、类、彰人、冬弥、司、笑梦、宁宁 | 文化节舞台剧引发瑞希与冬弥、彰人等互动。#72 后续故事明确回看更早的相识，并让瑞希将 25点成员介绍给 WxS。可作为神高校园/文化节和校友社交网的背景。 | [活动目录](https://pjsk.moe/zh-cn/story/event/7/)、[第4话「寻找学长！」](https://pjsk.moe/zh-cn/story/event/7/4/)、[第6话「昔日的文化节」](https://pjsk.moe/zh-cn/story/event/7/6/) |
| #58「白热！神高应援团！」 | 类、瑞希、杏、司、笑梦、宁宁、彰人、绘名 | 神山高校体育节的蓝组应援活动。瑞希与杏找类协助表演，类因为过去被否定的经历犹豫，瑞希察觉后支持他；类最终信任队友并提出演出方案。它把 WxS、VBS、25点角色放进同一校园活动。 | [活动目录（含概要）](https://pjsk.moe/zh-cn/story/event/58/)、[第2话「寄托于体育节的心愿」](https://pjsk.moe/zh-cn/story/event/58/2/)、[活动资料页](https://pjsk.moe/zh-cn/events/58/) |
| #72「逢此庆典 暮色亦染」 | 25点、L/n、MMJ、VBS、WxS 多名成员 | 涩谷大型庆典把多个组合放在街头摊位、舞台和后台。第6话里瑞希把奏、绘名介绍给类等人；大家提起绘名和笑梦的画画交情，也提及笑梦曾在意真冬状态。适合作为跨组合偶遇与集体演出的题材。 | [活动目录（10话）](https://pjsk.moe/zh-cn/story/event/72/)、[第6话（英文剧情正文）](https://pjsk.moe/en-us/story/event/72/6/)、[第7话简中页](https://pjsk.moe/zh-cn/story/event/72/7/) |
| #117「在不变的温暖旁」 | 瑞希、瑞希的姐姐 | 第3话开场两人购物后坐到“附近的这个家庭餐厅”；后续闪回瑞希幼年在学校遭同学嘲笑穿着、姐姐邀请她去购物。正文页标识“国服”，本话只证明一次购物后的家庭餐厅场景，未证明这是 25时常去的同一家店。活动共8话。 | [活动资料页](https://pjsk.moe/zh-cn/events/117/)、[活动目录](https://pjsk.moe/zh-cn/story/event/117/)、[正文页](https://pjsk.moe/story/event/117/3/)、[简中章节标题页](https://pjsk.moe/zh-cn/story/event/117/3/) |
| #141「Wonderhorror～？！的试胆！」 | 真冬、笑梦、穗波、瑞希、雫 | 真冬、笑梦和穗波为社区除草活动加办试胆；笑梦希望让害怕的人也能参加。第5话三人前往商场手工艺品店买材料，遇到刚和雫从缝纫休息室出来的瑞希，两人加入服装制作与活动。此处连接学校/社区活动、购物和缝纫空间。 | [简中活动页](https://pjsk.moe/zh-cn/story/event/141/)、[第5话「可爱又可靠的幽灵」英文正文](https://pjsk.moe/en-us/story/event/141/5/)、[活动资料](https://pjsk.moe/en-us/events/141/) |
| #145「荆棘之路通往何处」 | 瑞希、绘名及相关神高同学 | 这是瑞希的重要关系剧情，故事章节标题包含文化节。需要注意：第2话页面明确说明 asset 缺失；其他简中章节也出现动态加载。此次无法仅凭可读的原文镜像完整复述事件转折，故不把社区剧情摘要当作事实。 | [活动目录](https://pjsk.moe/zh-cn/story/event/145/)、[第2话缺失提示](https://pjsk.moe/zh-cn/story/event/145/2/)、[第4话「下定决心的文化节」](https://pjsk.moe/zh-cn/story/event/145/4/)、[活动资料](https://pjsk.moe/zh-cn/events/145/) |
| #150「用我们，布满伤痕的双手」 | 25点，封面角色绘名 | 活动资料页确认这是 25点活动、封面角色为绘名；第2、3话镜像页提示 asset 缺失。社区将它视为 #145 后续关系故事，但本报告只把“后续/情节解读”标为社区叙述，不将缺失原文的部分写成确认剧情。 | [活动资料页（含组合、角色、日期）](https://pjsk.moe/en-us/events/150/)、[第2话缺失提示](https://pjsk.moe/story/event/150/2/)、[第3话缺失提示](https://pjsk.moe/story/event/150/3/)、[简中第4话](https://pjsk.moe/zh-cn/story/event/150/4/) |
| #177「向无法解开的明天伸手」 | 奏、真冬、绘名、瑞希、瑞希姐姐 | 第1话四人讨论歌曲小样；随后瑞希得知姐姐因工作回日本、在涩谷开快闪店，并想到邀成员同行。活动索引列 8 话，但第7话的剧情 asset 未收录；本轮只逐读第1话。此为最新 25时四人本组活动故事，日服 2025 年举办，英语服 2026 年举办。[日服活动资料](https://pjsk.moe/ja-jp/events/177/)、[英语服活动资料](https://pjsk.moe/en-us/events/177/) | [第1话「令人高兴的消息」](https://pjsk.moe/zh-cn/story/event/177/1/)、[8话目录](https://pjsk.moe/zh-cn/story/event/177/)、[第7话缺档说明](https://pjsk.moe/story/event/177/7/)、[英语服官方公告](https://www.colorfulstage.com/news/detail/001132.html) |
| #179「Link the Beats!」 | 六位 Virtual Singer；跨 SEKAI | World Link 虚拟歌手篇。官方英语公告显示六位歌手各有章节，Moesekai 活动剧情目录列 15 话。可列为跨 SEKAI 背景素材；本轮没有逐话核对与 Nightcord SEKAI 对应的歌手是否及如何进入各章，不把它当作 25时四人互动证据。 | [活动资料](https://pjsk.moe/zh-cn/events/179/)、[15话目录](https://pjsk.moe/zh-cn/story/event/179/)、[第1话页](https://pjsk.moe/zh-cn/story/event/179/1/)、[英语服官方公告](https://www.colorfulstage.com/news/detail/001156.html) |

## 家庭餐厅线索：三种证据要分开

1. **活动故事 #117：**[第3话正文页](https://pjsk.moe/story/event/117/3/)标识“国服”，场景为瑞希和姐姐购物后在附近家庭餐厅歇脚；[简中标题页](https://pjsk.moe/zh-cn/story/event/117/3/)标题为《回忆起的……》。这是一次具体场景，不代表“常去”的固定门店。第2话「前往新年卖场吧！」和第4话「宝贵的心绪」标题可在[活动章节目录](https://pjsk.moe/zh-cn/story/event/117/)核对。

2. **MySekai 家具：**[家具 #424「常去的家庭餐厅的桌椅」](https://pjsk.moe/zh-cn/mysekai/424/)的页面字段写作“设施名称：常去的家庭餐厅的桌椅”；“角色对话”列出奏、真冬、绘名、瑞希；标签栏的原文是**“25点，Nightcord见。”** 这证明游戏资料里存在一件带 25点标签的家具，不等同于某一话剧情原文，也不能单独证明它就是 #117 的那家餐厅。

3. **卡牌剧情：**[卡牌剧情 #327「一如往常的拉面」](https://pjsk.moe/zh-cn/story/card/327/)的前篇让一歌、穗波、奏、真冬在家庭餐厅聊音乐和长发的不便；后篇切回奏与 Nightcord 成员在线聊天。它是卡牌剧情，不是活动剧情。[卡牌剧情 #949「找回回忆」](https://pjsk.moe/zh-cn/story/card/949/)中出现家庭餐厅背景与过去的生日合影，也是卡牌剧情，不是活动 #117 的补充章节。

**判断：**这三类资料足以把“家庭餐厅”列为固定地点候选，但没有证据证明三处描写是同一家店，也没有证据表明 #117 的餐厅就是家具里“常去”的地点。若要固定地点格，建议先把它视作“泛指的家庭餐厅场景”，不要给它编造店名或统一剧情出处。

## 社区热度与梗的交叉验证

**时效口径：**所有社区帖子日期是原帖发布日期；Reddit 票数和 Bilibili 播放/互动数字是 **2026-09-28 查看时页面或公开统计接口显示的累计值**，会随时间变化。播放量从发布日起累计，不能当作近期增速；单一帖子或单一视频也不能代表整体玩家。X 原帖页面本轮返回 403，未把 X 数据算进热度判断。

### 真冬×笑梦：“看穿假笑”粉丝梗

- Reddit 2023-09-15 的讨论贴查看时有 **389 票**，一条回复有 **177 票**，玩家把笑梦注意到真冬笑容不真诚和其他跨角色共情时刻作类比。[讨论帖](https://www.reddit.com/r/ProjectSekai/comments/16j8ccg/)
- Reddit 2025-11-04 的理论讨论贴查看时有 **312 票**；评论提出多种解释，说明这是粉丝解释而非统一共识。[讨论帖](https://www.reddit.com/r/ProjectSekai/comments/1oo8ci2/)
- Reddit 2026-09-03 的“Emu tries to scare you”梗图贴查看时有 **49 票**；评论里“*fake smile at emu*”只有 **2 票**。它说明该梗在近期仍会被引用，但这次互动量不高。[帖子](https://www.reddit.com/r/ProjectSekai/comments/1w6dgx2/)
- B站[真冬×笑梦互动合集](https://www.bilibili.com/video/BV165411T7zk/)发布于 2021-06-23，标题显示 2026-09-09 更新；截至 2026-09-28，公开统计为 **213,876 播放、9,444 赞、1,691 弹幕**。[公开统计接口](https://api.bilibili.com/x/web-interface/view?bvid=BV165411T7zk) 这是跨多个故事片段的粉丝字幕合集，不是 #4 单个活动的播放量。
- **结论：**跨 2023、2025、2026 的帖子和长期合集支持把它列为持续复现的粉丝梗；新近贴的互动量有限，因此宜称“长期经典梗、近期仍有零星引用”，不能称“2026 正在爆红”。“假笑侦测器”也不是官方设定或称号。

### 瑞希 #145/#150 关系剧情：高讨论度，但不适合直接做轻梗

- Reddit 2024-10-17 的 #145 活动讨论帖查看时有 **126 票**，玩家谈到文化节、瑞希和类的关系与故事张力。[讨论帖](https://www.reddit.com/r/ProjectSekai/comments/1g5o6j5/)
- B站 #150 中文字幕活动合集发布于 **2024-12-02**；截至 2026-09-28，公开统计为 **671,480 播放、10,944 赞、2,609 弹幕**。[视频](https://www.bilibili.com/video/BV1LK6TYWESL/)、[公开统计接口](https://api.bilibili.com/x/web-interface/view?bvid=BV1LK6TYWESL)
- Reddit 2025-06-30 的回顾贴查看时有 **1,102 票**，讨论 #145 在社群里被反复引用、玩梗，以及部分玩家对话题过度重复的疲劳感。[讨论帖](https://www.reddit.com/r/ProjectSekai/comments/1lnxrsn/)
- **结论：**跨平台证据支持 #145/#150 是高关注的长期故事线，但可见高互动集中于 2024–2025；本轮没有找到 2026 年围绕剧情本身的同等级新讨论，不能据旧数字说它目前仍是热点。玩家解释不能代替缺档章节原文。由于这条线涉及身份秘密和重要关系冲突，不建议直接轻梗化。

### #177「向无法解开的明天伸手」的近期观看数据

- B站 PJS字幕组的 8 话中文字幕合集发布于 **2025-08-25**；截至 2026-09-28，公开统计为 **151,072 播放、4,142 赞、582 弹幕、2,054 收藏**。[视频](https://www.bilibili.com/video/BV11YeWzmE2i/)、[公开统计接口](https://api.bilibili.com/x/web-interface/view?bvid=BV11YeWzmE2i)
- 另一个个人中文字幕版发布于 **2025-08-22**；截至查看日为 **7,334 播放、203 赞**。[视频](https://www.bilibili.com/video/BV1fie4zGEb4/)、[公开统计接口](https://api.bilibili.com/x/web-interface/view?bvid=BV1fie4zGEb4)
- Reddit 2026-09-14 有玩家在故事顺序问答中询问 Mizu5、World Link 与 #177 的阅读顺序；所在帮助帖查看时 **3 票**，该评论 **1 票**。[帮助串](https://www.reddit.com/r/ProjectSekai/comments/1wehhyd/help_and_question_thread_september_12th_2026/)
- **结论：**B站累积播放量说明这篇活动的中文字幕有可见受众；但主要观看发生在 2025 上线期，近期 Reddit 证据只是低互动的阅读顺序提问。本轮没有找到 2026 年围绕 #177 剧情本身的高互动讨论，故不标成当前热议。

### 其他活动：可见讨论不等于热门

- #141 试胆活动的 Reddit after-event 讨论帖发表于 2025-09-11，查看时 **40 票**。帖内有人称赞真冬—笑梦、真冬—穗波和瑞希—雫互动，也有人觉得情节普通；这只能说明有讨论，不能证明热门。[讨论帖](https://www.reddit.com/r/ProjectSekai/comments/1ndy6pb/)
- #58 的 Reddit 帖发表于 2022-05-09，查看时 **455 票**，内容主要是活动开跑、阵容与卡片期待，不是故事阅读热度，也不属于 2025–2026 的近期证据。[公告讨论帖](https://www.reddit.com/r/ProjectSekai/comments/ull5tm/)
- Reddit 2026-09-25 的 Help and Question Thread 置顶状态栏把 JP 当前活动列为「Connect to SEKAI!」、EN 列为「Wishes in Bloom!」；查看时该帖 **4 票**。这仅用于交叉核对分服当前活动状态，不是剧情热度证据。[讨论串](https://www.reddit.com/r/ProjectSekai/comments/1wqlr8a/help_and_question_thread_september_25th_2026/)
- #72 的 after-event 讨论和 #117 家庭餐厅场景，本轮没找到可证明“热门”的多帖互动数据。相关候选暂标“热度未验证”。

## 候选事件素材表

| 主题 | 建议标签 | 故事出处与可复用关系/地点 | 社区热度证据与局限 |
|---|---|---|---|
| 泛指家庭餐厅 | **固定地点候选** | #117 瑞希与姐姐购物后歇脚；家具 #424 有 25点标签；卡牌 #327/#949 是另外两类证据。未证实同一家店。[活动 #117 第3话](https://pjsk.moe/zh-cn/story/event/117/3/)、[家具 #424](https://pjsk.moe/zh-cn/mysekai/424/)、[卡牌 #327](https://pjsk.moe/zh-cn/story/card/327/)、[卡牌 #949](https://pjsk.moe/zh-cn/story/card/949/) | 未找到可靠的社区热度指标。多出处证明题材重复出现，不证明玩家热度或同一地点。 |
| 神山高校/体育节 | **固定地点候选** | #4 体育节与笑梦、真冬相关；#58 再次以神高体育节组织瑞希、类、杏等人。适合容纳不同活动效果，不需要固定某一个梗。[活动 #4](https://pjsk.moe/zh-cn/story/event/4/)、[活动 #58](https://pjsk.moe/zh-cn/story/event/58/) | #58 宣发帖 455 票只能证明对活动/卡组有讨论，不是剧情热度；具体热度未验证。[Reddit](https://www.reddit.com/r/ProjectSekai/comments/ull5tm/) |
| 空无「世界」 | **固定地点候选** | 主线有「无人『世界』」章节；官方页说明该 SEKAI 安静、空旷、无机质，适合作为反复出现的象征场景。[主线第6话](https://pjsk.moe/zh-cn/story/unit/6/nightcode_01_06/)、[SEGA 组合页](https://pjsekai.sega.jp/character/unite05/index.html) | 未找到可靠社区热度量化。需要留意它常承载严肃情绪，不宜默认搞笑化。 |
| 真冬×笑梦“看穿假笑” | **随机事件候选** | #4 体育节是早期相遇，#141 又延续两人的日常互动。可作为人物互动变体，不建议把“假笑侦测”写成官方能力。[#4 第4话](https://pjsk.moe/zh-cn/story/event/4/4/)、[#141 第5话](https://pjsk.moe/en-us/story/event/141/5/) | 2023、2025 Reddit 讨论与跨年合集支持“长期反复出现”；2026-09-03 又有一条 49 票梗图贴，但相关评论只有 2 票，表示近期零星引用而非正在爆红。所有数据于 2026-09-28 查看。[2023 讨论](https://www.reddit.com/r/ProjectSekai/comments/16j8ccg/)、[2025 讨论](https://www.reddit.com/r/ProjectSekai/comments/1oo8ci2/)、[2026 梗图](https://www.reddit.com/r/ProjectSekai/comments/1w6dgx2/)、[合集与实时累计统计](https://www.bilibili.com/video/BV165411T7zk/) |
| 涩谷庆典/多组合演出 | **随机事件候选** | #72 的主街摊位、后台、表演把 25点和其他四个组合成员交织在一起；适合角色随机碰面或多人同场。[活动 #72 第6话](https://pjsk.moe/en-us/story/event/72/6/) | 有 after-event 讨论，但未找到能支撑“热门”的互动指标；热度未验证。 |
| 试胆、社区除草、怪物服装制作 | **随机事件候选** | #141 连接真冬、笑梦、穗波、瑞希、雫；背景含社区活动、神社/山路、商场手工艺店和缝纫休息室。[活动 #141 第5话](https://pjsk.moe/en-us/story/event/141/5/) | 有 Reddit after-event 帖 40 票，内容称赞跨组合互动；讨论存在，热度未验证。[帖子](https://www.reddit.com/r/ProjectSekai/comments/1ndy6pb/) |
| 瑞希姐姐回国、涩谷快闪店 | **随机事件候选** | #117 是两姐妹逛店后的家庭餐厅回忆；#177 第1话提及姐姐因工作回日本、在涩谷开快闪店。可发展为亲友/逛店日常，不等于固定地点。[#117 第3话](https://pjsk.moe/zh-cn/story/event/117/3/)、[#177 第1话](https://pjsk.moe/zh-cn/story/event/177/1/) | B站 #177 字幕合集发表于 2025-08-25；截至 2026-09-28 有 151,072 播放/4,142 赞/582 弹幕，但这主要是上线期的累计观看。本轮未找到 2026 年围绕该剧情的高互动讨论，不能称当前热议。[视频与实时累计统计](https://www.bilibili.com/video/BV11YeWzmE2i/)、[低互动阅读顺序问答](https://www.reddit.com/r/ProjectSekai/comments/1wehhyd/help_and_question_thread_september_12th_2026/) |
| 人偶展览与真冬不适 | **随机事件候选** | #2 确认四人集体参观人偶展，但展览触发真冬的沉重情绪。[活动 #2 第4话](https://pjsk.moe/zh-cn/story/event/2/4/) | 未找到可靠热度数据。适合度取决于后续事件如何处理情绪，不建议拿创伤当笑料。 |
| 瑞希秘密揭露/绘名关系冲突 | **暂不适合**（作为轻松随机梗） | #145/#150 是严肃关系线；目前镜像章节存在素材缺失，不能完整复述原文。[#145 第2话缺档](https://pjsk.moe/zh-cn/story/event/145/2/)、[#150 第2话缺档](https://pjsk.moe/story/event/150/2/) | 2024–2025 的 Reddit 高票讨论和 #150 中文字幕合集累计互动支持它是长期受关注故事线；这些是旧帖和累积播放，不代表 2026 当前热度，且社群观点有分歧。[2024 讨论](https://www.reddit.com/r/ProjectSekai/comments/1g5o6j5/)、[B站合集](https://www.bilibili.com/video/BV1LK6TYWESL/)、[2025 后续讨论](https://www.reddit.com/r/ProjectSekai/comments/1lnxrsn/) |

## 尚待用户拍板的设计问题

1. “固定地点格”要用泛化的“家庭餐厅”，还是必须有原文能锁定的具体店铺？当前证据只支持泛指场景，不能把 #117、家具 #424 和两篇卡牌剧情认定为同一家店。
2. 固定地点是否包含空无「世界」这类心理/象征空间，还是限定为现实地点？
3. 事件格保持纯随机时，地点格应从多个事件效果中如何选择？本报告不替用户定选择规则。
4. 瑞希、真冬等人的严肃故事主题可以进入多少比例的搞笑事件？是否设定不把被欺凌、秘密揭露、家庭压力做成惩罚梗的边界？
5. 是否明确把 25点的校外社交圈纳入候选角色池，例如笑梦、类、雫、穗波、一歌、杏、彰人、冬弥？若纳入，跨组合人物出现频率由什么原则控制？
6. 素材采用哪一服剧情为准（国服简中、日服或国际服）？部分故事页只有英文/日文正文或章节资产缺失，名称与本地化可能不同。
7. “热门”要达到什么证据门槛？可选按跨平台重复出现、多个高互动帖、或持续多年讨论记录区分，不宜只凭一个帖子定为热门。

## 来源表

### 故事原文、章节与官方交叉核验

- [Moesekai 25点主线目录](https://pjsk.moe/zh-cn/story/unit/6/)
- [SEGA 25时组合官方简介](https://pjsekai.sega.jp/character/unite05/index.html)
- [SEGA 宵崎奏资料](https://pjsekai.sega.jp/character/unite05/kanade/index.html)、[朝比奈真冬资料](https://pjsekai.sega.jp/character/unite05/mafuyu/index.html)、[东云绘名资料](https://pjsekai.sega.jp/character/unite05/ena/index.html)、[晓山瑞希资料](https://pjsekai.sega.jp/character/unite05/mizuki/index.html)
- [活动 #2](https://pjsk.moe/zh-cn/story/event/2/)、[#4](https://pjsk.moe/zh-cn/story/event/4/)、[#7](https://pjsk.moe/zh-cn/story/event/7/)、[#58](https://pjsk.moe/zh-cn/story/event/58/)、[#72](https://pjsk.moe/zh-cn/story/event/72/)、[#117](https://pjsk.moe/zh-cn/story/event/117/)、[#141](https://pjsk.moe/zh-cn/story/event/141/)、[#145](https://pjsk.moe/zh-cn/story/event/145/)、[#150](https://pjsk.moe/zh-cn/events/150/)、[#177 简中目录](https://pjsk.moe/zh-cn/story/event/177/)、[#177 日服活动资料](https://pjsk.moe/ja-jp/events/177/)、[#177 英语服活动资料](https://pjsk.moe/en-us/events/177/)、[#177 第7话缺档页](https://pjsk.moe/story/event/177/7/)、[#179「Link the Beats!」15话目录](https://pjsk.moe/zh-cn/story/event/179/)、[#180「Wishes in Bloom!」资料页](https://pjsk.moe/zh-cn/events/180/)、[#180 区域对话分类](https://pjsk.moe/zh-cn/story/area/event_180/)
- [英语服官方公告：#177「Tying Tomorrow’s Ribbon」，2026-08-22 至 08-28 PT](https://www.colorfulstage.com/news/detail/001132.html)、[#179「Link the Beats!」，2026-09-06 至 09-18 PT](https://www.colorfulstage.com/news/detail/001156.html)
- [家庭餐厅家具 #424](https://pjsk.moe/zh-cn/mysekai/424/)、[卡牌剧情 #327](https://pjsk.moe/zh-cn/story/card/327/)、[卡牌剧情 #949](https://pjsk.moe/zh-cn/story/card/949/)

### 社区讨论及可见互动数据

- [日服 #218「Connect to SEKAI！」活动页](https://pjsk.moe/ja-jp/events/218/)、[2话故事目录](https://pjsk.moe/ja-jp/story/event/218/)、[官方公告](https://prtimes.jp/main/html/rd/p/000007610.000005397.html)。
- [Reddit 2026-09-25 当前活动状态串](https://www.reddit.com/r/ProjectSekai/comments/1wqlr8a/help_and_question_thread_september_25th_2026/)在 2026-09-28 查看为 4 票；置顶信息列 JP #218、EN #180。仅作分服活动状态的交叉核对，不作为剧情热度证据。

- [Reddit：MafuEmu/HonaKana 讨论，原帖 2023-09-15；2026-09-28 查看为 389 票、177 票高赞回复](https://www.reddit.com/r/ProjectSekai/comments/16j8ccg/)
- [Reddit：笑梦与真冬“假笑”理论，原帖 2025-11-04；2026-09-28 查看为 312 票](https://www.reddit.com/r/ProjectSekai/comments/1oo8ci2/)
- [Reddit：Emu tries to scare you，原帖 2026-09-03；2026-09-28 查看为 49 票，相关评论 2 票](https://www.reddit.com/r/ProjectSekai/comments/1w6dgx2/)
- [B站：真冬×笑梦互动合集，2021-06-23 发布、标题显示 2026-09-09 更新；2026-09-28 统计为 213,876 播放/9,444 赞/1,691 弹幕](https://www.bilibili.com/video/BV165411T7zk/)、[公开统计接口](https://api.bilibili.com/x/web-interface/view?bvid=BV165411T7zk)
- [Reddit：Mizu5 活动讨论，原帖 2024-10-17；2026-09-28 查看为 126 票](https://www.reddit.com/r/ProjectSekai/comments/1g5o6j5/)
- [B站：活动 #150 中文字幕剧情合集，2024-12-02 发布；2026-09-28 统计为 671,480 播放/10,944 赞/2,609 弹幕](https://www.bilibili.com/video/BV1LK6TYWESL/)、[公开统计接口](https://api.bilibili.com/x/web-interface/view?bvid=BV1LK6TYWESL)
- [Reddit：Mizu5 社群讨论与梗疲劳，原帖 2025-06-30；2026-09-28 查看为 1,102 票](https://www.reddit.com/r/ProjectSekai/comments/1lnxrsn/)
- [B站：#177 中文字幕剧情合集，2025-08-25 发布；2026-09-28 统计为 151,072 播放/4,142 赞/582 弹幕/2,054 收藏](https://www.bilibili.com/video/BV11YeWzmE2i/)、[公开统计接口](https://api.bilibili.com/x/web-interface/view?bvid=BV11YeWzmE2i)
- [B站：#177 个人中文字幕版，2025-08-22 发布；2026-09-28 统计为 7,334 播放/203 赞](https://www.bilibili.com/video/BV1fie4zGEb4/)、[公开统计接口](https://api.bilibili.com/x/web-interface/view?bvid=BV1fie4zGEb4)
- [Reddit：故事阅读顺序提问，原评论 2026-09-14；2026-09-28 查看所在帮助串 3 票、评论 1 票](https://www.reddit.com/r/ProjectSekai/comments/1wehhyd/help_and_question_thread_september_12th_2026/)
- [Reddit：Wonderhorror after-event，原帖 2025-09-11；2026-09-28 查看为 40 票](https://www.reddit.com/r/ProjectSekai/comments/1ndy6pb/)
- [Reddit：活动 #58 宣发讨论，原帖 2022-05-09；2026-09-28 查看为 455 票（过时的宣发讨论，不作近期剧情热度）](https://www.reddit.com/r/ProjectSekai/comments/ull5tm/)
