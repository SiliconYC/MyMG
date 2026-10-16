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

## 站点配置和限制

- 工作流 `pages.yml` 使用官方 `configure-pages`, `upload-pages-artifact`, `deploy-pages`；**只配置已经创建的 Pages 站点**，不再用受限 `GITHUB_TOKEN` 尝试首次创建。
- **已完成管理员初始化：** Source = GitHub Actions；现为公开仓库，REST `has_pages=true`。如果未来站点被禁用，才需要管理员重新启用。
- 此仓库目前为 public，Pages 公开可访问；不要将私人材料上传到静态资源。
- Chat 沙盒此前无法连接 NPM registry；首次依赖安装和最终 WebGL 页面验收交由经授权的 GitHub Runner 执行。
- 已生成并提交真实 `pnpm-lock.yaml`；Runner 使用 `pnpm install --frozen-lockfile`。

## 验收

PR Workflow 会：安装依赖 → `pnpm check` → `pnpm build:portal` → Playwright 截图首页和 HBM 播放页 → 上传截图 Artifact。任何 E2E 尚未在 Runner 实际执行前不能算通过。

**正式部署已经成功：** [Pages run #38843210375](https://github.com/SiliconYC/MyMG/actions/runs/38843210375) 的 `configure-pages`、构建、`deploy-pages` 和公开网址 HTML/资源验证全部成功。

**公开网站端到端测试已经成功：** [Live QA run #38851346908](https://github.com/SiliconYC/MyMG/actions/runs/38851346908) 在真实 `https://siliconyc.github.io/MyMG/` 上使用 Chromium：验证首页，`/#/hbm` 的 WebGL、播放/暂停/单帧步进、六个时间点的像素差异，及 `/#/demo` 的独立二维场景与手机视口。截图与指标保存于 Actions artifact `mymg-pages-live-qa`。对应 [Issue #9](https://github.com/SiliconYC/MyMG/issues/9) 已关闭。

**独立网页不需要逐个初始化 Pages。** `/#/hbm` 和 `/#/demo` 是同一静态网站的 hash 路由，新增作品只需更新 `catalog.ts` 后按需部署。`apps/studio` 为内部制作工具，不是另一个 Pages 站点。

新的线上回归 `.github/workflows/pages-live-qa.yml` 只支持手动执行或其工作流文件变动时自动执行，避免日常开发每次调用浏览器 Runner。