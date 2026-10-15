# MyMG 架构约定

## 分层

- **apps/studio/**：唯一 Remotion 入口，所有 Composition 在一个地方注册。
- **packages/mg/**：当前唯一的基础组件包，提供时间曲线、正交 3D 和排版容器。
- **animations/<slug>/**：主题代码、模型与实验，不复制工作室及公共依赖。
- **tooling/**：本地截帧、视频元数据检测、静态与单元测试。

## 基本规则

1. **确定性动画**：动作由帧号计算，使用 Remotion useCurrentFrame；避免 setInterval、墙钟、Math.random、useFrame 连续循环来驱动最终渲染。
2. **统一世界空间**：同一镜头的正交视角不随意改变。默认 OrthographicStage 采用近似 2:1 轴测方向；只在指定区间内改变摄像机缩放和平移。
3. **阅读安全区**：文字要清晰、稳定、易读；与 3D 主体接近时使用局部半透明背景，不能用整屏遮罩盖住模型。
4. **真实空间排序**：主体、其特写与总览使用同一世界坐标，遮挡遵循三维深度关系。
5. **平台组件克制**：明确的平台能力可以共用；只有经过多个 MG 验证重复需求后再抽象其他组件，不提前拆成十几个包。
6. **单一依赖体系**：所有 remotion 和 @remotion/* 版本必须精确一致，工作区只有一份根 pnpm-lock.yaml（联网安装后生成并提交），项目不得各自安装一套独立包。
7. **研发流程**：每次从 dev 创建临时分支，经过测试和审查再合并 dev；不碰 main。

## 新 MG 如何接入

- 在 animations/<slug>/web/ 新建工作区包及 React 场景。
- 在 apps/studio/src/root.tsx 添加 Composition，声明 ID、宽高、帧率、帧数。
- 从 packages/mg 导入公共能力，只写自身独有的画面与动作。
- 用 pnpm frames 截取时间线关键点，核验遮挡、运动、构图，再渲染完整视频。
- 不把生成的 MP4、逐帧图及缓存提交 Git。

HBMInfrastructureCheck 是最低限度的 3D 接线测试，而不是新 Mustard 成片。
