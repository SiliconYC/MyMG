# 共用程序包（预留）

当多个 MG 原型真正需要共享代码时，在这里建立 npm 工作区程序包，例如时间轴、缓动、2:1 正交投影、React 组件和浏览器渲染器。

当前 HBM 原型使用 Python，不需要强行引入 npm 依赖，也不提前建立空壳库。以后新增程序包时采用 `packages/<名称>/package.json`，由根目录 npm workspaces 管理。
