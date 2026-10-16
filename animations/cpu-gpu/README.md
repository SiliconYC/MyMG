# CPU / GPU · 平行架構 3D 動畫

- 入口：`https://siliconyc.github.io/MyMG/#/cpu-gpu`
- 原生 React + Three.js WebGL，630 幀 / 30 FPS；播放器可暫停、拖曳和逐格。
- 第一幕：四顆大型 CPU 核心與八十條 GPU 運算通道浮現。
- 第二幕：相同指令處理大量獨立資料，GPU 通道一起處理，CPU 分批完成。
- 第三幕：彼此不同的分支任務，CPU 各核心執行不同控制流，GPU 以交錯兩組示意分歧執行。
- 第四幕：保留三維成果對比。
- 教學模型，並非實體 CPU/GPU 的核心數、精確排程、規格或實測速度比。此處 GPU lane 表示示意性的運算單元，不等於完整獨立 CPU 核心。
- 禁止用 MP4、影格圖片、影片紋理替代 Three.js 幾何。
