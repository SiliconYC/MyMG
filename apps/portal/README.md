# MyMG Pages Portal

此网站是所有 MG 项目的**唯一公开入口**。首页从 `src/catalog.ts` 渲染作品清单，项目链接使用 `/#/<project-id>` 哈希路由：刷新项目页不会产生 GitHub Pages 404。

当前演示：`/#/hbm` — HBM 浏览器三维技术样片，不是原 Python Mustard-03 影片。

## 本地开发

在仓库根目录运行 `corepack pnpm install` 和 `corepack pnpm --filter @mymg/portal dev`；默认 http://127.0.0.1:5173/MyMG/ 。

## 打包与部署

`corepack pnpm --filter @mymg/portal build`，GitHub Actions 中使用 始终使用 `/MyMG/` 静态资源前缀。

## 新增作品

1. 在根目录执行 `node tooling/new-mg.mjs example '示例动画'`，自动新建 `animations/example/web` 工作区包、添加门户与 Studio 依赖并更新真实 pnpm 锁文件。
2. 修改场景 JSX 和 `apps/portal/src/catalog.ts` 的元数据，按需设置独立封面 `cover: {type:'image', src:'...', alt:'...'}`；不设置则使用通用占位图。
3. 执行 `pnpm check`、`pnpm build:portal`、`pnpm qa:portal:react`，需要 WebGL 的场景再执行严格浏览器 `pnpm qa:portal`。
4. 门户和 Studio 共用注册表。`/#/<id>` 可直接播放、暂停、拖动与逐帧浏览，不要复制新门户，也不再人工修改 `apps/studio/src/root.tsx`。

作品播放器支持暂停、拖动进度条、逐帧前后退。不要将视频、字体文件或未经授权的素材提交到仓库。

> 真实 WebGL 与关键帧严格验收在 GitHub Runner 上执行；普通 React 交互可在具备 Chromium 的 OpenAI 沙盒运行。
