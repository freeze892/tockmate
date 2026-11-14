# TickMate Design System

> 视觉契约：滴答清单（TickTick）Windows 桌面端的结构与交互语言；工艺质感参考 Notion 设计体系（耳语边框、多层低透明度阴影、克制的字阶）。本文件是所有 UI 实现的唯一视觉事实源。

## 0. Research Log

- Embedded refs: 短名单 [notion.md（温暖极简效率工具）、linear.app.md（冷灰密度工具）] → 选定 **minimalist-skill (Layer A) + notion.md (Layer B) + layout-skill（应用外壳）**，因为滴答清单是"轻量纸面感"的效率工具，与 Notion 的温暖极简同族，而用户明确要求模拟滴答清单 → 其结构/主色/组件形态以滴答清单为契约，工艺令牌从 Notion 提取。
- Lazyweb: 未运行 — 用户指定的参照产品明确（滴答清单），其设计语言已内化为契约（蓝色主色、浅灰侧栏、圆角勾选框、任务胶囊），无需外部屏幕采样。
- Imagen drafts: 未运行 — 本项目为像素级可实现的工具型 UI，HTML 原型即设计稿，无需求助图像生成。
- Skipped lanes: lazyweb / imagen — 见上，均为"参照明确"而非"工具不可用"。

## 1. Atmosphere & Identity

安静清爽的个人效率工位：白纸般的主面板、浅灰侧栏、一处蓝色点睛。信息密度适中——任务行之间有呼吸感，日期与优先级用小号彩色文本轻声提示，绝不喧哗。签名视觉是**圆形勾选框 + 清单色点 + 日历里的圆角任务胶囊**：三个小元素贯穿全部界面，是 TickMate 的指纹。

## 2. Color

### Palette（浅色）

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/app | --surface-app | #FFFFFF | #1E1F23 | 主面板背景 |
| Surface/sidebar | --surface-sidebar | #F7F7F8 | #191A1D | 侧栏、标题栏 |
| Surface/hover | --surface-hover | #F2F3F5 | #2A2B30 | 行悬停、次级按钮底 |
| Surface/selected | --surface-selected | #EBF0FE | #2A3552 | 侧栏选中项、今日格高亮 |
| Surface/elevated | --surface-elevated | #FFFFFF | #26272C | 弹层、详情面板、卡片 |
| Text/primary | --text-primary | #1F2329 | #E8EAED | 任务标题、标题栏文字 |
| Text/secondary | --text-secondary | #646A73 | #9AA0A8 | 日期说明、副文本 |
| Text/tertiary | --text-tertiary | #8F959E | #6B7078 | 占位符、禁用 |
| Border/default | --border-default | #E5E6EB | #33353A | 分隔线、卡片描边 |
| Border/subtle | --border-subtle | #EFF0F1 | #2A2B30 | 更轻的分隔 |
| Accent/primary | --accent-primary | #4772FA | #5B84FF | 主按钮、选中态、链接、"今天" |
| Accent/hover | --accent-hover | #3A63E8 | #4A74F0 | 主按钮悬停 |
| Priority/high | --priority-high | #E5484D | #F2555A | 高优先级旗标、逾期日期 |
| Priority/medium | --priority-medium | #F5A623 | #F0AC3D | 中优先级旗标 |
| Priority/low | --priority-low | #4772FA | #5B84FF | 低优先级旗标 |
| Status/success | --status-success | #3BA55D | #46B56A | 同步成功、完成态 |
| List palette | --list-1..8 | 见下 | 同浅色（暗底加亮 8%） | 清单色点、任务胶囊 |

List palette（清单/胶囊用色环）：#4772FA 蓝、#2EA7E0 青、#22A88E 蓝绿、#64B94C 绿、#F5A623 橙、#E5484D 红、#9A6BF2 紫、#E065A6 粉。

### Rules
- 表面层级靠「白主面板 + 浅灰侧栏 + 耳语边框」区分，不靠重阴影。
- 蓝色只用于交互与"今天"语义；一个界面内饱和蓝不超过 3 处主视觉。
- 清单色是唯一的多彩来源，以 6px 色点 / 胶囊左侧条出现，不做大面积铺色。
- 永不引入表外颜色；需要新语义先扩表。

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Page title | 20px | 600 | 1.3 | -0.01em | 主面板顶部标题（今天 10月25日） |
| H3 | 16px | 600 | 1.4 | 0 | 详情面板任务标题、卡片标题 |
| Body | 14px | 400 | 1.5 | 0 | 任务标题、正文（基准字号） |
| Body/md | 13px | 400 | 1.45 | 0 | 副信息、表单标签 |
| Caption | 12px | 400 | 1.4 | 0 | 日期 chip、计数、元数据 |
| Overline | 11px | 600 | 1.3 | 0.05em | 侧栏分组标签（智能清单/清单）大写不适用中文，仅加灰 |

### Font Stack
- Primary: `"Segoe UI", "Microsoft YaHei UI", "PingFang SC", system-ui, sans-serif`（Windows 原生，中文优先雅黑）
- Mono: `"Cascadia Mono", "Consolas", monospace`（番茄钟计时数字）
- 不引入 Inter/Roboto；正文不小于 12px。

## 4. Spacing & Layout

### Base Unit：4px

| Token | Value | Usage |
|-------|-------|-------|
| --space-1 | 4px | 图标与文字间 |
| --space-2 | 8px | 行内紧凑组 |
| --space-3 | 12px | 表单字段内距 |
| --space-4 | 16px | 卡片内距、任务行垂直内距 |
| --space-5 | 20px | 面板区块间 |
| --space-6 | 24px | 卡片默认内距 |
| --space-8 | 32px | 区块分隔 |

### Grid（应用外壳，1280×800 基准）
- 外壳：`grid-template-columns: 240px 1fr 320px`（详情面板可收起）；标题栏 36px 常驻顶部。
- 滚动所有权：侧栏不滚出自身（内部滚动）；任务列表是主滚动区（`min-height: 0; overflow: auto`）；详情面板内部滚动；日历整格自适应视口高度不滚动。
- 日历网格：7 列等宽 `repeat(7, 1fr)`，行高 `minmax(96px, 1fr)`。

### Rules
- 侧栏宽度、面板宽度是结构令牌，不随内容变化。
- 任务行高 ≈ 44px；日历格子最小 96px。

## 5. Components

### Sidebar Nav Item
- **Structure**: 24px 图标/色点 + 标签 + 右侧计数
- **States**: default（透明底）、hover（--surface-hover）、selected（--surface-selected，图标与文字转 --accent-primary 或保持原色）
- **Spacing**: 高 32px，左右内距 12px，图标-文字 8px
- **Accessibility**: 全键盘可达，selected 用底色+文字色双重区分

### Task Row
- **Structure**: 18px 圆形勾选框 + 标题 + 行尾元信息（日期 chip、优先级旗标、清单名）
- **Variants**: 普通 / 有时间 / 逾期（日期红）/ 已完成（勾选+标题删除线+整体降透明 0.55）
- **States**: hover（--surface-hover）；勾选框 hover 出现描边；checked 勾选框填充 --status-success
- **Spacing**: 高 44px，左右 20px，勾选框-标题 12px
- **Motion**: 勾选时勾选框 scale 微弹（120ms）；删除线 150ms 展示

### Task Pill（日历胶囊）
- **Structure**: 高 20px 圆角条，左侧 2px 清单色条 + 时间(可选) + 标题，超出省略
- **States**: hover 加深底色；completed 降透明 + 删除线
- **Spacing**: 圆角 4px，格内堆叠 gap 2px

### Calendar Cell
- **Structure**: 右上角日期数字（今天为白字蓝圆）、胶囊堆栈、右下 "+N"
- **States**: today（--surface-selected 底）、other-month（整体 0.45 透明）、hover（--surface-hover）
- **Spacing**: 内距 6px；日期数字 12px

### Primary Button
- **Structure**: 蓝底白字，圆角 6px，高 32px
- **States**: hover --accent-hover；active scale(0.98)；focus 2px 外环
- Ghost Button: 透明底 1px --border-default 描边，hover --surface-hover

### Checkbox（圆形）
- 18px 圆，1.5px 描边 --text-tertiary；checked 填充清单色或 --status-success，白勾；有优先级时描边转优先级色

### Input / Select
- 高 32px，1px --border-default，圆角 6px，focus 转 --accent-primary + 3px rgba(71,114,250,.15) 外环

### Progress Ring（番茄钟）
- SVG 圆环，底环 --border-subtle，进度环 --accent-primary（休息态转 --status-success），中心等宽数字 56px mono

### Habit Card
- **Structure**: 40px 彩底圆图标 + 名称/连续天数 + 7 日点阵 + 今日打卡圆按钮
- **States**: 未打卡（描边圆按钮）、已打卡（填充绿 + 白勾）、点阵内当日高亮描边

### Setting Field Row
- 标签 + 控件水平排布，标签 13px --text-secondary；区块间用 overline 小标题 + 24px 间距

### States 补充（全局）
- 焦点：所有可交互元素 2px --accent-primary 外环；悬停均有 --surface-hover 反馈；禁用 0.4 透明。

## 6. Motion & Interaction

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 120ms | ease-out | 勾选弹动、按钮按压 |
| Standard | 200ms | ease-in-out | 面板展开、悬停底色过渡 |
| Emphasis | 400ms | cubic-bezier(0.16,1,0.3,1) | 详情面板滑入 |

- 只动 transform/opacity；`prefers-reduced-motion` 时全部转瞬时。
- 悬停必须有意义：行悬停=可点击暗示；无交互元素不加动效。

## 7. Depth & Surface

**策略：borders + 超软阴影混合（Notion 式耳语边框为主）**

| Level | Value | Usage |
|-------|-------|-------|
| Whisper | 1px solid var(--border-default) | 面板分隔、卡片、输入框 |
| Soft | 0 1px 2px rgba(0,0,0,.03), 0 2px 8px rgba(0,0,0,.04) | 悬浮卡片 |
| Prominent | 0 4px 12px rgba(0,0,0,.06), 0 12px 32px rgba(0,0,0,.08) | 弹层、右键菜单 |

单层阴影透明度永不超 0.08。

## 8. Accessibility Constraints & Accepted Debt

### Constraints
- WCAG 2.1 AA：正文对比 ≥4.5:1（#1F2329/#FFF = 16.2:1；#646A73/#FFF = 5.9:1；蓝 #4772FA 白字仅用于 ≥14px 粗体按钮，对比 4.6:1）
- 每个可交互元素可见焦点环、可键盘到达；勾选框为真实 input 或 role=checkbox
- `prefers-reduced-motion` 全局尊重

### Accepted Debt
| Item | Location | Why accepted | Owner / Exit |
|------|----------|--------------|--------------|
| 原型阶段使用静态 SVG 图标而非图标库 | prototypes/ | 原型自包含单文件要求；实现期统一封装图标组件 | Sprint 1 |
