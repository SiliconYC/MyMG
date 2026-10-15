# GitHub Pages / 单门户管理

目标：`https://siliconyc.github.io/MyMG/` 是全部 MG 项目的统一入口，打开 `/#/<id>` 即可播放，无需导出 MP4。

## 编码和依赖

- `apps/portal/`：唯一浏览器门户，React + Vite + Remotion Player。
- `apps/studio/`：内部 Remotion Studio，主要用于制作和按需输出影片。
- `animations/*/web/`：各项目自身的 MG 场景组件；不可复制网站底座。
- `packages/mg/`：共用 3D 摄影机、时间计算、文字组件。
- `apps/portal/src/catalog.ts`：唯一的项目导航注册表。

## 运转方式

- 从 `dev` 建临时分支，在 PR 中运行按需的结构、类型、构建及 Playwright 截图验收。
- 合并回 `dev` 后，只有影响网页的路径变化才触发 Pages 发布。`main` 不参与部署和开发。
- Pages 静态资源基址必须是 `/MyMG/`。使用哈希路由，刷新深链接仍加载 `index.html`。
- `@remotion/player` 在浏览器预览逐帧确定性动画；并不启动 Remotion MP4 渲染。
- 播放器独立于 3D 图形，3D 场景仍需具备 WebGL。CI 可使用 Playwright Chromium 软件渲染测试。

## 首次启用和限制

- 工作流 `pages.yml` 使用官方 `configure-pages`, `upload-pages-artifact`, `deploy-pages`，尝试自动启用 Pages。
- 若未启用或 GitHub 限制自动启用，需要到仓库 Settings → Pages → Build and deployment → Source 选择 GitHub Actions。
- GitHub Pages 私人仓库须满足相应订阅权限；传统个人 Pages 站点通常公开可见，不代表私有预览。
- Chat 沙盒此前无法连接 NPM registry；首次依赖安装和最终 WebGL 页面验收交由经授权的 GitHub Runner 执行。
- 先运行 `pnpm install --no-frozen-lockfile`，获得真实锁文件后提交根目录 `pnpm-lock.yaml`，不要手工编造。

## 验收

PR Workflow 会：安装依赖 → `pnpm check` → `pnpm build:portal` → Playwright 截图首页和 HBM 播放页 → 上传截图 Artifact。任何 E2E 尚未在 Runner 实际执行前不能算通过。

已确认首次 `configure-pages@v5` 创建 Pages 站点返回 `Resource not accessible by integration`。需由仓库管理员手动启用 Pages，一次即可；后续 `dev` 上的构建部署均由现有工作流负责。
