# MG 制作质量检查

静态类型正确并不意味着动画可交付。建议每次按以下顺序：

1. **结构测试**：pnpm check；纯时间曲线由 Node 自带测试框架验证。
2. **入口检查**：pnpm compositions 列出 Studio 已注册的作品。
3. **关键帧截图**：pnpm frames <CompositionID> 0,30,60,90 检查片头、转场、主体和片尾。
4. **全片渲染**：pnpm render <CompositionID> output/example.mp4。
5. **技术元数据**：pnpm qa output/example.mp4 <时长秒数> <fps>，检查编码、帧率、时长、尺寸与音轨。
6. **视觉复核**：人工审阅关键帧及转场前后连续帧，排除 Z 排序、错位、遮挡、瞬时闪烁、镜头漂移与字幕停留不足。
7. **自主修复**：发现问题先修后交付，不将基础质检转交给用户。

上述命令在本地或受允许的沙盒运行，不默认调用 GitHub Runner。无 npm 网络时应注明无法完成真实端到端渲染。
