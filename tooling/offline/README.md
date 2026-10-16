# Linux x64 / Node 22 离线依赖恢复

[打包工作流](https://github.com/SiliconYC/MyMG/actions/workflows/offline-bundle.yml) 仅首次在 dev 引入时自动执行；后续升级 pnpm-lock.yaml 时手动 workflow_dispatch，不在每次提交上重复消耗 Runner。

Runner 在线下载锁文件完整 pnpm store、pnpm 10.20.0 与 Playwright Chromium。删除 node_modules、阻断 registry 后通过 frozen 离线安装、pnpm check、门户构建和 Chromium 网页 QA，才将压缩包与 SHA256SUMS 发布到**持久 GitHub Release**，标签包含锁文件 SHA256 前 16 位。不要依赖临时 Actions Artifact。

在新 Linux x86_64 + Node.js 22 沙盒，先从对应的 [GitHub Releases](https://github.com/SiliconYC/MyMG/releases) 获取两个文件 mymg-offline-linux-x64-node22.tar.gz 和 SHA256SUMS，放在同一目录；进入仓库执行：

    bash tooling/offline/restore.sh /path/to/release-assets
    bash tooling/offline/verify.sh

restore.sh 校验包散列和仓库 pnpm-lock.yaml；从本地 tarball 安装 pnpm，离线恢复依赖。verify.sh 再次强制禁用 registry，完成真实 check / build / 浏览器交互截图。依赖缓存位于被忽略的 .mymg-offline/。

**尚需验证：** GitHub Release 文件必须被实际递送至新沙盒，沙盒网络被禁用时不能直接联网下载。Chromium 运行还依赖沙盒系统动态库；仓库只打包浏览器与 JS 包，不携带系统库。首次 Runner 完成、Release 存在且另一全新沙盒通过 verify.sh 之前不算跨沙盒验收通过。
