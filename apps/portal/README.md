# MyMG Pages Portal

此网站是所有 MG 项目的**唯一公开入口**。首页从 `src/catalog.ts` 渲染作品清单，项目链接使用 `/#/<project-id>` 哈希路由：刷新项目页不会产生 GitHub Pages 404。

门户现将 `/#/hbm` 切换为 React Three.js 实时生成的 Mustard-03 动画（345 帧），不再播放 MP4；`/#/demo` 仍为非 HBM 独立二维 MG 模板。正式网址 `https://siliconyc.github.io/MyMG/`。

## 本地开发

在仓库根目录运行 `corepack pnpm install` 和 `corepack pnpm --filter @mymg/portal dev`；默认 http://127.0.0.1:5173/MyMG/ 。

## 打包与部署

`corepack pnpm --filter @mymg/portal build`，GitHub Actions 中使用 始终使用 `/MyMG/` 静态资源前缀。

## 新增作品

1. 在根目录执行 `node tooling/new-mg.mjs example '示例动画'`，自动新建 `animations/example/web` 工作区包、添加门户与 Studio 依赖并更新真实 pnpm 锁文件。
2. 修改场景 JSX 和 `apps/portal/src/catalog.ts` 的元数据，按需设置独立封面 `cover: {type:'image', src:'...', alt:'...'}`；不设置则使用通用占位图。
3. 执行 `pnpm check`、`pnpm build:portal`、`pnpm qa:portal:react`，需要 WebGL 的场景再执行严格浏览器 `pnpm qa:portal`。
4. 门户和 Studio 共用注册表。`/#/<id>` 可直接播放、暂停、拖动与逐帧浏览，不要复制新门户，也不再人工修改 `apps/studio/src/root.tsx`。

作品播放器支持暂停、拖动进度条、逐帧前后退。HBM 由 React 计算每一帧的空间坐标，并在 Three.js WebGL 中将 Python 的 2:1 轴测投影、四层 DRAM、TSV 和 GPU/八 HBM 封装绘制出来。网站不加载视频、不提供帧图素材。浏览器 QA 核对真实 WebGL 上下文与九帧截图；严格像素一致性仍需基准差异统计。不要将视频、字体文件或未经授权的素材提交到仓库。

> 真实 WebGL 与关键帧严格验收在 GitHub Runner 上执行；普通 React 交互可在具备 Chromium 的 OpenAI 沙盒运行。

## 线上验收

2026-10-16 GitHub Pages 发布已成功，`has_pages=true`；[部署执行](https://github.com/SiliconYC/MyMG/actions/runs/38843210375) 和 [真实 Chromium / WebGL / 双作品测试](https://github.com/SiliconYC/MyMG/actions/runs/38851346908) 已通过。后续需要查线上截图时手动执行 `.github/workflows/pages-live-qa.yml`，不要每次提交都运行。

## CPU / GPU 原生 3D MG

- 首頁卡片及直達路由：`https://siliconyc.github.io/MyMG/#/cpu-gpu`。
- React Three.js 實時 WebGL 場景，21 秒循環、30 FPS、630 幀；可拖曳、逐幀、暫停。
- 相同指令與分歧工作兩種情境，實際動態 3D 運算單元和輸出格，不用影片、圖片序列或替代玩家。
- 檢查：`pnpm check`、`pnpm build:portal`、`pnpm --filter @mymg/portal qa:cpu-gpu`（需先啟動預覽及 Playwright Chromium）。
