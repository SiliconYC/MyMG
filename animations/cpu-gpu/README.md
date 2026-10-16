# CPU / GPU · 極簡 3D 運算架構

正式路由：`https://siliconyc.github.io/MyMG/#/cpu-gpu`

15 秒、30 FPS、450 幀。純 React + Three.js 原生幾何，支援暫停、拖動及逐格研究。

- 0–5.5 秒：**CPU**。鏡頭只看四個大型核心，依次活動。
- 5.5–10.7 秒：**GPU**。鏡頭橫移到 64 個小運算單元；相同操作同步升降。
- 10.7–15 秒：**並置**。鏡頭退後，同時看到數量與運作節奏的對比。

不在畫面塞進文字說明、跑分百分比、粒子、網格與進度條。僅保留 CPU／GPU 名稱，採 HBM 類似的暖白背景和正交透視。核心數及動畫速度純粹是教學抽象，並非硬體真實比例；CPU/GPU 都不保證特定工作負載的效率。

驗收：`pnpm check`、`pnpm build:portal` 以及 Chromium WebGL `pnpm --filter @mymg/portal qa:cpu-gpu`。
