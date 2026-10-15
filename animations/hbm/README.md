# HBM 科普 MG 动画

**主题：** 用约 11.5 秒介绍 HBM（高带宽存储器）的垂直堆叠、TSV 互连以及多组 HBM 与 GPU 的封装关系。

这个项目是动画与信息可视化的技术实验，不是芯片制造工艺图或商业交付品。模型采用固定 2:1 正交轴测投影。四层 DRAM 是示意层数；最后的 GPU 与八组 HBM 布局参考 B200 的概念结构，**不代表实际精确尺寸、层数或布线**。

## 当前版本

- 主入口：`src/make_mustard03.py`（Mustard-03；源自实验中的第 11 版几何模型）
- 依赖源：`src/hbm_v11_src/`（各阶段原始 Python 几何与动画模块，保留其历史组织供追溯）
- 历史试验：`experiments/`（Mustard-01、Mustard-02 参考脚本；存在旧的运行环境路径，不作为正式入口）
- 视频、音频、逐帧截图：**不存入 Git**。

## 运行

安装 Python 3.10+、FFmpeg，以及思源黑体同源的 `Noto Sans CJK SC` 和 `Inter` 字体。Linux 环境可以使用系统发行版自带的字体包（仓库不分发字体）。

```bash
python -m pip install -r animations/hbm/requirements.txt
python animations/hbm/src/make_mustard03.py --stills
python animations/hbm/src/make_mustard03.py --range 0 345 --out animations/hbm/output/hbm_silent.mp4
```

生成的 `output/` 已经加入 `.gitignore`。动画按帧计算场景状态，不依赖实时播放速度。配乐**没有放入仓库**；以后可以单独建立经授权核实的音频素材工作流。

## 下一步可逐步沉淀

- 动画速度曲线、镜头稳定性和分镜可读性检查。
- 正交三维的遮挡排序和渲染测试。
- 图文安全区及文本背景的设计规范。
- 多 HBM 堆叠的布局与布线示意准确性。

初期只固定代码和简要结构，评审标准可在后续版本迭代后再整理。
