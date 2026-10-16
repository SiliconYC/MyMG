# MyMG — 动态图形实验工作台

本仓库用于批量实验 Motion Graphics（MG）的**程序化动画、三维讲解、镜头语言、排版、音画同步与自动化质量检查**，不是对外提供商业视频服务的产品。只沉淀源码、工具和有价值的工程经验，不提交生成视频。

## 技术路线

- **主线：** React + TypeScript + Remotion + Three.js / React Three Fiber。
- **单一工作室：** `apps/studio` 注册和预览所有作品。
- **公共能力：** `packages/mg` 提供统一摄影机、逐帧缓动和可读文字层。
- **独立原型：** `animations/<主题>/` 自己管理场景和素材，不重复搭建工作室。
- **旧项目兼容：** HBM 原有 Python 代码仍保留在 `animations/hbm/src/`。`animations/hbm/web/` 只提供基础设施验收场景，不等同于下一版 HBM 正片。

## 运行

需要 Node.js 22.16+、pnpm 10+。安装一次即可为所有项目复用依赖：

```bash
corepack enable
pnpm install
pnpm studio
```

在 Studio 中预览 `SystemCheck`（二维）和 `HBMInfrastructureCheck`（三维）。

```bash
pnpm render HBMInfrastructureCheck output/hbm-check.mp4
pnpm frames HBMInfrastructureCheck 0,30,60,120,149
pnpm qa output/hbm-check.mp4 5 30
pnpm check
```

详细运行流程、验收原则参见 [架构](docs/architecture.md) 与 [检查清单](docs/quality.md)。字体需在运行机器上安装合规授权的字体；**不随仓库分发字体文件**。

## 版本与分支

- `main` 保持稳定，不经明确指令禁止合并。
- `dev` 为日常集成分支。
- 每次改动必须从 `dev` 新开临时分支，验证后以 PR 合并回 `dev`。
- 每个实验允许独立实现特殊效果；经过多个项目验证后才抽取公共组件。
- 自动化渲染与测试默认**在本地或 OpenAI 沙盒运行**，不默认使用 GitHub Actions Runner。

**依赖锁文件：** `pnpm-lock.yaml` 应由首次联网的 `pnpm install` 生成后提交。请不要手工编写或使用未经验证的锁文件。

## GitHub Pages 项目门户

- **入口：** `https://siliconyc.github.io/MyMG/`（需首次成功启用 Pages 才能访问）。
- **作品链接：** `https://siliconyc.github.io/MyMG/#/hbm`。
- **门户代码：** `apps/portal/`，所有可播放作品统一在 `apps/portal/src/catalog.ts` 登记。
- **Web 样片：** 当前只有 HBM 三维基础设施演示，**不是**旧 Python Mustard-03 成片；后续每个 MG 都可逐步移植为浏览器作品。
- **体验：** 作品页支持播放、暂停、时间轴拖动、单帧前后退和移动端浏览；不需要先导出 MP4。

本地开发：在仓库根目录执行 `corepack pnpm install`、`corepack pnpm portal`。静态站点建置：`corepack pnpm build:portal`。仓库不托管生成的视频文件。

部署工作流 `.github/workflows/pages.yml` 只在 `dev` 中与门户有关的路径变化时运行，或者手动触发；并不为文档、Python 实验等每个提交都调用 Runner。PR 上的截图验收工作流 `.github/workflows/portal-qa.yml` 也只在 Web 文件变化时触发。

初次部署可能需要在 GitHub `Settings → Pages → Build and deployment` 选择 **GitHub Actions**。私有仓库的 Pages 可用性取决于 GitHub 计划；即使仓库私有，通常访问者也可以公开访问已发布站点。勿将内部机密或授权受限素材引入静态网站。详情见 [门户说明](apps/portal/README.md)。

**Pages 首次开通需要管理员一次性操作：** `Settings → Pages → Source → GitHub Actions`。首次 Runner 构建已成功，但 GitHub App 的 `GITHUB_TOKEN` 缺少创建 Pages 站点的权限（`Resource not accessible by integration`）。此操作不影响 `main` 的代码。

## 新作品接入（单注册表）

`node tooling/new-mg.mjs sample-title "我的动画"` 自动创建 `animations/sample-title/web/src/sample-title.tsx` 并在 `apps/portal/src/catalog.ts` 登记。门户与 Studio **共用同一份 catalog**；无须第二次手工登记，也不用复制门户。脚手架自动生成独立 workspace package，注册两个应用的工作区依赖，并运行 `pnpm install --lockfile-only --offline` 真正更新锁文件；锁文件更新后按需重建离线 Release。

可参考非 HBM 的 `animations/demo/web/src/demo.tsx`。每个作品支持 `/#/<id>`、暂停/播放、时间轴及逐帧。封面按项目的 `cover` 字段显示专属图片或 HBM 插画；未配置时自动使用通用封面。图片需是已授权的仓库内相对路径，不提交字体或未经授权素材。

沙盒无 WebGL 时先运行 `pnpm check`、`pnpm build:portal` 与 `pnpm qa:portal:react`；Runner 使用严格 `pnpm qa:portal` 验证真实 WebGL、关键帧与截图。离线包详情参见 [恢复说明](tooling/offline/README.md)。GitHub Pages 首次启用依赖仓库管理员操作，参见 [Pages 说明](docs/pages.md)。
