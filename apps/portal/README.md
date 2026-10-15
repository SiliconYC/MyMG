# MyMG Pages Portal

此网站是所有 MG 项目的**唯一公开入口**。首页从 `src/catalog.ts` 渲染作品清单，项目链接使用 `/#/<project-id>` 哈希路由：刷新项目页不会产生 GitHub Pages 404。

当前演示：`/#/hbm` — HBM 浏览器三维技术样片，不是原 Python Mustard-03 影片。

## 本地开发

在仓库根目录运行 `corepack pnpm install` 和 `corepack pnpm --filter @mymg/portal dev`；默认 http://127.0.0.1:5173/MyMG/ 。

## 打包与部署

`corepack pnpm --filter @mymg/portal build`，GitHub Actions 中使用 始终使用 `/MyMG/` 静态资源前缀。

## 新增作品

1. `animations/<id>/web` 实现一个由 Remotion `useCurrentFrame()` 决定每一帧内容的 React 组件。
2. 在 `apps/portal/src/catalog.ts` 中加入作品元数据、组件、长度、分辨率、帧率。
3. 门户自动显示新卡片及 `/#/<id>` 作品播放页；无需新建单独的 React App。

作品播放器支持暂停、拖动进度条、逐帧前后退。不要将视频、字体文件或未经授权的素材提交到仓库。
