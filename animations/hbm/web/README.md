# HBM Web 基础设施接线示例

HBMInfrastructureCheck 验证统一 Studio、Three.js 正交摄影机、共享组件及基于帧号的堆叠计算。它**不代表 Mustard 系列下一版**，也不是 B200 封装的精确工业模型。Pages 的 `/#/hbm` 不再以此 5 秒场景充当正式片；改为 `mustard03-native.tsx` 与 `mustard03-model.ts` 在 React/Three.js 实时重建，沿用原 Python 的几何、正交摄影机与 345 帧时间轴。没有视频或帧图作为画面源。

正式 HBM 历史代码仍在 animations/hbm/src/，后续迁移必须单独建分支，不能覆盖旧成果。
