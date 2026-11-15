# TockMate

**本地优先的 Windows 待办 & 专注工具** —— 清单、日历、番茄钟、习惯、WebDAV 同步，一个不少。

> 无遥测 · 数据 100% 存在你自己的磁盘 · 界面语言：中文（简体）

## 特性

- 🗂️ 清单 / 智能视图 / 标签 / 批量操作
- 📅 日历月视图，拖拽改期
- ⏱️ 番茄专注（主进程状态机驱动）
- 🔔 到期提醒（系统通知横幅）
- 🔁 重复任务规则引擎（跨月钳制 / 闰年 / 多星期几，纯函数单测覆盖）
- 🖥️ 桌面迷你悬浮窗：今日待办 · 快速添加（自然语言日期）· 置顶开关 · 贴边收进
- 🔒 应用锁 · 📊 统计报表（热力图/趋势/分布）· ☁️ WebDAV 同步（坚果云可用）· 📤 导出/导入（含图片附件）

## 安装

从 [Releases](../../releases) 下载 `TockMate-Setup-x.x.x.exe`。

> 安装包当前未做代码签名，SmartScreen 提示时点「更多信息 → 仍要运行」。

## 开发

```bash
npm install
npm run dev                        # vite + electron 编排启动（防孤儿进程）
npm test                           # vitest，109 例
npm run build                      # 渲染层构建
npx electron-builder --win nsis    # 产出 NSIS 安装包
```

技术栈：Electron 45 · Vue 3 · Vite 8 · Pinia 4 · vitest。

## 目录速览

```
electron/   主进程（窗口/调度器/存储/同步/安全护栏）
src/        Vue 渲染层（组件 + Pinia store + 纯函数工具）
tests/      vitest 单测
build/      打包资源（图标 / EULA / NSIS 片段）
prototypes/ 高保真 HTML 原型（设计基准）
```

## 许可

- **源码**：[MIT](./LICENSE)
- **安装包（二进制）**：随附《TockMate 个人使用许可协议》（见 `build/license.txt`，非商用授权）
