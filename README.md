# LingYi HTML Runner

在线 HTML / CSS / JavaScript 编辑器与实时预览工具。

## 正式入口

**https://lingyi.tools/tools/html-runner**

本仓库同步保存正式站当前使用的源码，作为历史归档和独立构建依据。
GitHub Pages 地址只保留迁移提示，不再运行第二套工具。

## 功能

- HTML / CSS / JavaScript 编辑与实时预览
- 多文件管理、代码片段和命令面板
- 格式化、撤销 / 重做、导入与导出
- Gemini 与 OpenAI 兼容接口的 AI 辅助
- 中英文切换和明暗主题

本地设置和 API Key 保存在浏览器 `localStorage`，不会写入仓库。

## 本地运行

```bash
npm ci
npm run dev
```

构建：

```bash
npm run build
npm run preview
```

需要 AI 功能时，可复制 `.env.example` 为 `.env.local` 并填写
`GEMINI_API_KEY`，也可以在页面右上角的 API 设置中填写 Key。

## 归档说明

- 源码基线同步自 `ai-tools-navigator/app/tools/html-runner`。
- 正式部署由工具站负责，本仓库不维护第二套线上入口。
- GitHub Pages 只发布跳转到正式入口的提示页。
- 图片、视频和现有素材均未修改或压缩。

## 许可证

本仓库尚未声明开源许可证。在补充许可证前，默认保留所有权利。
