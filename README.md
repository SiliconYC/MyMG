# MyMG — 动态图形实验工作台

用于批量实验 MG（Motion Graphics）的程序化动画、三维科普、运镜、排版、音画同步以及质量检查。**这是技术原型仓库，不对外提供商用级服务**；优先沉淀源码、实验经验，不提交渲染产物。

## 架构

- **Web 主线**：React + TypeScript + Remotion + Three.js / React Three Fiber。
- **apps/studio/**：唯一的 Remotion 工作室，统一注册、预览和渲染所有作品。
- **packages/mg/**：唯一的共享组件包（正交摄影机、确定性缓动、文字安全区）。
- **animations/**：每个 MG 一个项目目录；现有 HBM Python 代码完整保留。
- **animations/hbm/web/**：仅用于验证新基础设施，不是 Mustard-04。
- **tooling/**：本地截帧、视频元数据检查、工作区与时间曲线测试。

## 安装与运行

需要 Node.js 22.16+、pnpm 10+；需要渲染时安装 FFmpeg。所有 Web 项目只在仓库根目录安装一次依赖。

    corepack enable
    pnpm install
    pnpm studio

在 Studio 中可选择 SystemCheck（二维）或 HBMInfrastructureCheck（三维）。

    pnpm compositions
    pnpm render HBMInfrastructureCheck output/hbm-check.mp4
    pnpm frames HBMInfrastructureCheck 0,30,60,120,149
    pnpm qa output/hbm-check.mp4 5 30
    pnpm check

注：由于初次搭建环境无法联网访问 npm，尚不能实际安装依赖及完成 Studio 视频渲染的端到端验证。首次成功安装时应生成并提交根目录 pnpm-lock.yaml；不得手工伪造锁文件。现已通过不依赖 npm 的结构测试、缓动测试与 TypeScript 语法检查。

详细原则参见 docs/architecture.md 与 docs/quality.md。字体由运行环境依法安装，仓库不分发字体文件。

## 分支与交付约定

1. **dev**：日常集成分支。修改前先从 dev 派生临时分支，完成并检查后创建 PR 合并 dev。
2. **main**：未经用户明确指令，**禁止合并或提交**。
3. 不默认使用 GitHub Actions Runner，验证优先本地或允许的沙盒。
4. 重要工程经验逐步从实例中提炼为公共能力，不为了抽象而抽象。
5. 音乐、影片和逐帧结果默认不入 Git；素材许可需单独确认。
