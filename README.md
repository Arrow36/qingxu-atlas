# 情绪地形图

一张可拖拽、可缩放的中文情绪词地图，帮助写作者和所有对感受好奇的人，在强度、语气与场景之间探索更准确的表达。

在线体验：<https://arrow36.github.io/qingxu-atlas/>

## 特点

- 210 个中文情绪词、成语与短语
- 以“平静”为中心，沿六个主要情绪方向连续分布
- 越远离中心，表达强度越高
- 点击词条可查看原创释义、辨析、例句与词义核验链接
- 支持拖动、缩放、搜索以及 JSON 数据导入导出

## 本地运行

需要 Node.js 22.13 或更新版本。

```bash
pnpm install
pnpm dev
```

生成 GitHub Pages 静态站点：

```bash
GITHUB_PAGES=true pnpm build:pages
```

生成结果位于 `dist/client/`。

## 数据

词条数据位于 `app/data/emotions.json`。释义、辨析和例句为本项目独立撰写，方便后续审校、扩充或替换。

## 许可

- 代码：MIT License
- 原创词条释义、辨析与例句：CC BY 4.0

详见 [LICENSE.md](./LICENSE.md)。
