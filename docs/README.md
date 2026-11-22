# 文档索引

本文件是本仓库全部文档的入口。每份文档的职责、内容与适用场景见主表;文档之间的优先级与维护约定见后文。文档只写机制与约定,不写进度、时间计划与时间戳。

## 一、主表

| 文档 | 职责一句话 | 主要内容 | 什么时候需要读 | 主要读者（Agent、用户、贡献者、维护者） |
|:---:|:---:|:---:|:---:|:---:|
| [README.md](../README.md) | 面向使用者的中文总览 | 定位、收录条件、两层签名与信任、索引文件、标签与错误码、产物静态扫描、目录结构、本地命令 | 第一次接触本索引,或需要运行校验、构建与签名命令时 | 用户、贡献者 |
| [README.en-US.md](../README.en-US.md) | 中文总览的英文版本 | 与中文 README 对应的英文说明 | 读者不使用中文,或需要引用英文口径时 | 用户、贡献者 |
| [plugins/README.md](../plugins/README.md) | 插件目录的本仓增量规范 | 三层布局权威出处声明、作者名收录口径、版本 `meta.json` 校验口径、作者多签命名、产物静态扫描、收录流程 | 新增作者、插件或版本目录,核对作者名写法与收录步骤时 | 维护者、贡献者、Agent |
| [.github/plugins-sources.README.md](../.github/plugins-sources.README.md) | 收录来源清单的字段与执行说明 | 清单字段、示例、收录时发生的动作与收录之后的产物 | 提交或修改来源清单,或排查某次收录为何跳过时 | 维护者、Agent |
| [docs/design/collection-and-author-signing.md](design/collection-and-author-signing.md) | 收录管线与两层签名的设计说明 | 阶段划分与失败语义、作者签名与整站签名的分工、产物静态扫描为何只警告、与社区合集的信任模型差异、未定稿事项 | 判断某个失败该阻断还是警告,或改动签名与校验边界时 | 维护者、Agent |
| [docs/design/pages-artifacts.md](design/pages-artifacts.md) | `dist/` 发布产物的职责划分 | 每份产物的生成者、读取者、是否进入整站签名、体积随什么增长 | 改动构建或签名脚本,或核对发布内容是否齐全时 | 维护者、Agent |
| [docs/README.md](README.md) | 本仓库文档的索引入口 | 主表、冲突优先级、文档分层、维护约定 | 查找文档,或新增、删除、改写文档时 | 用户、贡献者、维护者、Agent |

索引范围是当前分支的源码文档。`dist/` 下是构建副本,`single-branch/` 下是其他分支的工作树,两者都不列入本索引;插件目录内的占位说明随正式收录删除时,按维护约定同步移除对应行。三层布局的结构条文在合集模板仓 dsc-plugin-set-template 的 `template/plugins/README.md`,该文件属于另一仓库,不列入本索引。

## 二、冲突时以谁为准

文档描述约定,脚本产生事实。两者不一致时按下列顺序判定,并把偏差当作文档缺陷在当轮修掉:

| 顺序 | 依据 | 覆盖范围 | 冲突时的处理 |
|:---:|:---:|:---:|:---:|
| 1 | 校验、构建、收录与签名脚本的实际行为 | [自洽性校验](../scripts/lib/collection-verify.mjs)、[构建](../scripts/build-collection.mjs)、[收录](../scripts/import-plugins.mjs)、[整站签名](../scripts/sign-site.mjs)、[签名自检](../scripts/verify-site.mjs) 的退出码、错误码与产物 | 脚本行为是发布结果的唯一事实基准;文档与脚本不符时改文档,不以文档描述放行产物 |
| 2 | 结构规范 | [插件目录规范](../plugins/README.md) 与 [来源清单说明](../.github/plugins-sources.README.md) | 规范细化脚本约定;与脚本冲突时以脚本为准,并同轮修改规范 |
| 3 | [README.md](../README.md) 与 [README.en-US.md](../README.en-US.md) | 面向使用者的概览与命令入口 | 与规范冲突时以规范为准;README 不承载可执行判据 |
| 4 | [设计文档](design/collection-and-author-signing.md) 与 [发布产物说明](design/pages-artifacts.md) | 失败语义、信任边界与取舍理由 | 解释「为什么」,不作判据;与前三者冲突时修正设计文档,不用它裁决实现 |
| 5 | 本索引 | 文档职责与查阅路径 | 只回答「读哪份」,不定义任何校验规则 |

错误码与级别以校验结果里的 `problems[].code` 与 `level` 为准,失败语义见[收录与作者签名](design/collection-and-author-signing.md)第六节。证书与签名是否有效,以实际验证结果为准,文档不构成信任判据。

## 三、文档分层

| 分层 | 文档 | 面向 | 写作边界 |
|:---:|:---:|:---:|:---:|
| 对外文档 | [README.md](../README.md)、[README.en-US.md](../README.en-US.md) | 使用者、插件市场读者与外部贡献者 | 说明定位、收录条件、标签规则、签名概览与命令入口;不展开实现细节与设计取舍 |
| 维护者文档 | [plugins/README.md](../plugins/README.md)、[收录与作者签名](design/collection-and-author-signing.md)、[发布产物说明](design/pages-artifacts.md)、[docs/README.md](README.md) | 组织维护者、接手者 | 写结构规范、失败语义、信任边界与理由;机制变更时与脚本同轮更新 |
| Agent 执行文档 | [.github/plugins-sources.README.md](../.github/plugins-sources.README.md),以及各脚本顶部的用法注释与 `--help` 输出 | 执行收录、校验、构建与签名的 Agent | 只写可执行动作、输入输出与判据;不重复设计理由,判断依据仍回到第 1、2 层 |

## 四、维护约定

- 新增、删除、重命名或移动文档时,同一提交内更新本索引主表与相关链接;文档归档或拆分后不得留下失效入口。
- 机制变更当轮更新对应文档,不推迟到后续提交:

| 变更内容 | 当轮要同步的文档 |
|:---:|:---:|
| 校验规则、错误码或错误级别 | [README.md](../README.md) 的标签与错误码说明、[产物静态扫描](../README.md#产物静态扫描)一节、[收录与作者签名](design/collection-and-author-signing.md)第六节 |
| 目录、版本或清单字段 | [plugins/README.md](../plugins/README.md) 与 [来源清单说明](../.github/plugins-sources.README.md) |
| 构建产物集合或签名覆盖 | [发布产物说明](design/pages-artifacts.md)、[README.md](../README.md) 的索引与构建说明 |
| 收录步骤或 CI 阶段顺序 | [来源清单说明](../.github/plugins-sources.README.md)、[README.md](../README.md) 的收录流程、[构建与发布流程](../.github/workflows/build-and-deploy.yml) |
| 文档新增或删除 | 本索引主表与分层表 |

- 错误码以 `verifyCollection` 返回的 `code` 为准,新增、改名或调整级别时同步上表列出的文档。
- 文档不写时间戳、开发进度与时间计划;已有的 `docs/design/` 结构保持稳定,新文档放入与其读者和职责相符的目录。
- 本索引只列文档、职责与查阅路径,不复述文档正文。
