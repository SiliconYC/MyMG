# 机械摆钟：反冲式锚擒纵

[在线预览](https://siliconyc.github.io/MyMG/#/pendulum-clock) · [几何与动力学蓝图](BLUEPRINT.md) · [验证记录](RESULTS.md)

60 秒原生 React / Three.js / Remotion 动画。从整钟转到背面与稳定的擒纵特写，再回到同轴秒针；可以暂停、逐帧和任意拖动时间轴。画面没有视频、GIF 或预渲染帧。

## 机构如何运动

30 齿黄铜擒纵轮与一体钢制锚叉共用可见和接触几何。入瓦、出瓦是**两条不同倾角的有限斜平面**，轮齿沿实际工作面滑动，越过工作面的末端才脱离，随后被对侧接住。锚叉与摆锤固定在同一根轴上。

这是参考动图中的**反冲式锚擒纵**：摆向外运动时，会通过接触把轮轴短暂推回；返回时，受恒定驱动力矩的轮齿推动摆锤。承接期间轮角并不固定，秒针也会有对应的细微反冲。

- 两个固定轴刚体，由重力、恒定轮轴力矩、线性阻尼及非负法向接触冲量求解。
- 固定子步 `1/1920 s`；一次性初始摆角 `-0.065 rad`，不补踢摆锤、不指定余弦轨迹或放行时间窗。
- 接触与节拍来自几何及真实承接事件；没有按秒数取整或奇偶侧别制造节拍。
- 碰撞轮齿、有限瓦面与 Three.js 挤出使用相同轮廓。倒角向实体内侧收，不在接触面之外添加实体。
- 固定初始条件积分，缓存每帧状态。倒放、随机拖动和重复播放一致；分数帧从前一个缓存状态固定步进，不用可能穿透的线性姿态插值。

## 验证

```sh
pnpm install --frozen-lockfile
pnpm check
MYMG_BASE_PATH=/MyMG/ pnpm build:portal
pnpm --filter @mymg/portal exec vite preview --host 127.0.0.1 --port 4174 --strictPort
```

另开终端执行：

```sh
MYMG_QA_URL=http://127.0.0.1:4174/MyMG/ pnpm --filter @mymg/portal qa:clock
```

需要先安装 Playwright Chromium：`pnpm --filter @mymg/portal exec playwright install chromium`。也可以通过 `MYMG_QA_BROWSER` 指定本机 Chrome 可执行文件。`MYMG_QA_URL` 可替换为公开预览地址，以同一套检查验收线上版本。默认截图与诊断保存在仓库 `output/qa-clock/`，不提交生成媒体。

单独的机构测试：`node --experimental-strip-types --test tooling/pendulum-clock.test.mjs`。包括一分钟交替承接、反冲、逐子步穿透、整件锚叉间隙、实际三维倒角、无驱动对照、减半步长收敛与确定性拖动。

## 物理边界与来源

模型采用理想固定轴、集中转动惯量、无摩擦工作面和完全非弹性接触，耗散由碰撞损失与轴系线性阻尼表示；恒定轮轴力矩代表上游动力。没有模拟发条、重锤轮系、机架弹性、齿面润滑、磨损或长期走时精度，不是实物加工认证。场景按教学需要放大机构比例，物理长度换算见蓝图。

原理与运动参考：[Anchor escapement](https://en.wikipedia.org/wiki/Anchor_escapement)、[Chetvorno 的反冲动图（CC0）](https://commons.wikimedia.org/wiki/File:Anchor_escapement_animation_217x328px.gif)。外观参考：[Timwether 的实拍（CC BY-SA 3.0）](https://commons.wikimedia.org/wiki/File:Anchor_escapement.jpg)。参考图片不嵌入动画。

`animations/escapement-physics-lab` 是独立实验，本次没有用它的旧试验结果替代新机构验证，也没有修改其实现。
