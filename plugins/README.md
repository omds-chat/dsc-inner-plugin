# 插件目录

本目录存放索引收录的全部插件,按「作者 / 插件 / 版本」三层组织。目录名与清单字段一一对应,校验脚本对不上就报错。

本索引只收录从 DeepSeek-Chat-Enhanced 本体解耦出来的可选内部插件。条目由收录流程写入,不手工编辑;未收录插件时,`plugins.json` 为空,`plugins/` 下只有本文件、`author_manifest.json` 与已登记的作者目录。

## 增量声明

「作者 / 插件 / 版本」三层布局的目录结构条文以合集模板仓 dsc-plugin-set-template 的 `template/plugins/README.md` 为权威出处。该仓库与本仓同为组织工作区内的并列仓库,只读参考,本文不给链接。本文只写本仓增量: 作者名的收录口径、版本 `meta.json` 的校验口径、作者多签命名、产物静态扫描与收录流程。

## 作者名的收录口径

作者目录名即作者英文名称,与 `plugins.json` 的 `author`、`plugins/author_manifest.json` 的 `username` 一致,目录写作 `plugins/<author>/`。本仓增量口径:

- 目录名仅允许大小写字母、数字、连字符,不得以连字符开头,以收录脚本 `scripts/import-plugins.mjs` 的 `AUTHOR_PATTERN`(`^[A-Za-z0-9][A-Za-z0-9-]*$`)为准。
- 作者名判定大小写不敏感: 两个作者目录仅大小写不同视为同一名称,按重复处理。收录时与既有作者目录或已登记作者仅大小写不同的写法直接拒绝,要求沿用已登记的写法;校验时发现仅大小写不同的两个作者目录报 `AUTHOR_DIR_DUPLICATE` 错误,阻断发布。
- 作者目录内的作者公钥按签名者序号配对,配对规则见下文「作者多签命名」。

## meta.json 的校验口径

本仓校验对版本目录内的 `meta.json` 只强制两个字段: `name` 必须与 `plugins.json` 的 `plugin_name` 一致,`version` 必须与版本目录名一致;其余字段服务于插件运行时与市场展示,索引校验不检查它们。字段全集与取值规则见权威出处与模板仓的插件开发规范(`specs/plugin-develop-spec.md`)。

## 作者多签命名

同一位作者可以有多个签名者。签名文件与公钥按序号配对,序号 1 沿用既有文件名:

| 签名者序号 | 版本目录内的签名 | 作者目录内的公钥 |
|:---:|:---:|:---:|
| 1 | `plugin.js.author.sig` | `author_pub.pem` |
| 2 | `plugin.js.author.sig.2` | `author_pub.2.pem` |
| n | `plugin.js.author.sig.<n>` | `author_pub.<n>.pem` |

- 序号从 2 起必须是十进制、不带前导零,上限 16;`plugin.js.author.sig.1`、`plugin.js.author.sig.02` 这类写法不合约定,校验只提示并忽略。
- 序号不必连续:某位签名者撤签时删除自己的签名与公钥即可,其余签名者的序号不变。
- 用序号而不是签名者姓名,是因为签名者姓名没有组织级注册表;序号只依赖同一目录内相邻的两个文件,校验方不需要额外映射表,扩容时只追加一对文件。
- 单个签名者的目录结构与历史产物完全兼容:`.author.sig` 前缀保留,按该后缀识别作者签名的工具(例如 `scripts/sign-site.mjs` 的孤儿签名清理)继续有效。

作者签名是可选项,但对 dsc 自研插件是默认项:插件构建设置 `AUTHOR_SIGN_ENABLE=true` 并提供 `AUTHOR_SIGN_PRIVATE_KEY` 时才会产出,收录时缺失只警告,该版本仍只有整站签名。

签名文件与作者公钥按序号一对一配对,两份缺一不可:

- 只有签名文件(`plugin.js.author.sig` 或 `.author.sig.<n>`)没有对应序号的公钥,判为该签名者无法校验,不算通过。
- 只有公钥(`author_pub.pem` 或 `author_pub.<n>.pem`)没有对应的签名文件,判为该版本作者签名缺失,不算通过。
- 两种情形都只记警告、不阻断发布,也不影响该版本的其他签名材料;作者签名本来就是可选层。

多位签名者逐位校验,任一失败只记警告、不阻断发布;校验报告里保留完整的签名者列表,便于界面展示多个签名者。

签名都是对文件原始字节的签名,不做换行规范化。任何一字节差异(包括 LF 与 CRLF 的差别)都会让校验失败。

## 产物静态扫描

每个版本的 `plugin.js` 都要过产物静态扫描: 插件不得自建网络通道,产物里不得出现 `fetch(`、`XMLHttpRequest(`、`WebSocket(`、`EventSource(`、`navigator.sendBeacon(` 与远程地址的 `import(`。命中报 `PLUGIN_NETWORK_SELFTALK` 警告: 收录照常写出该版本目录,`pnpm verify` 与 `pnpm build` 照常通过,退出码仍为 0。

扫描只认全局对象上的直接调用,规则、误伤与盲区见根目录 [README](../README.md#产物静态扫描)。它与作者签名同一口径: 两者都只警告、不阻断,是否收录由维护者复核判断。

## 新增内部插件的步骤

收录一个内部插件分目录、清单、签名与校验四个环节,执行者各不相同:手工只改来源清单与标签,其余由收录脚本、插件构建与 CI 完成。

| 环节 | 执行者 | 写入位置 | 说明 |
|:---:|:---:|:---:|:---:|
| 目录 | CI 收录脚本 `scripts/import-plugins.mjs` | `plugins/<author>/<plugin>/<x.y.z>/` 与 `versions.json` | 目录名与版本号取自产物 `meta.json`,不手工建 |
| 清单 | 组织维护者声明来源,CI 写入清单 | `.github/plugins-sources.json`、`plugins/author_manifest.json`、`plugins/<author>/plugin_manifest.json`、`plugins.json` | 来源清单是唯一人工入口;新条目 `tag` 留空,事后从根目录 `tags.json` 补 |
| 签名 | 作者签名由插件仓库构建产出,整站签名由 CI 产出 | 版本目录的 `plugin.js.author.sig`(多签 `.author.sig.<n>`)、`plugins/<author>/author_pub.pem`、`author_pub.<n>.pem` 与 `dist/<文件>.sig`、`web_files.json`、`eec.pem` | 本仓库不生成任何签名,只接收产物并在 `dist/` 上签整站 |
| 校验 | CI 与插件市场 | 只读 | CI 跑 `pnpm verify`、`pnpm build`、`pnpm verify:site`;其中 `pnpm verify` 与 `pnpm build` 会静态扫描 `plugin.js`,命中 `PLUGIN_NETWORK_SELFTALK` 只警告、不阻断;市场按根目录 README 的顺序复核 |

签名与校验的分工再强调一次:

- 作者签名:由插件仓库的构建完成。dsc 作为作者用 Ed25519 私钥只签 `plugin.js`,产物是 `dist/plugin.js.author.sig` 与 `dist/author_pub.pem`(多签再加 `.author.sig.<n>` 与 `author_pub.<n>.pem`);收录脚本把同名文件原样复制进版本目录与作者目录,不重新签名、不改名。
- 整站签名:由本仓库 CI 的 `scripts/sign-site.mjs` 完成,需要 `secrets.DSC_INNER_PLUGIN_EEC_SECRET` 与 `secrets.DSC_INNER_PLUGIN_EEC`,覆盖 `dist/` 内全部 `.html`、`.js`、`.css`、`.json`。签名只落在 `dist/`,`plugins/` 源码目录不出现整站签名文件。
- 校验:索引结构与公钥材料的错误在 CI 侧阻断发布,标签不在根目录 `tags.json` 词表内同样阻断;作者签名的校验结果一律只记警告,逐位签名者给出结论,不阻断发布,与插件市场侧口径一致。

当前状态: 作者目录 `plugins/omds-chat/` 与 `plugins/author_manifest.json` 已建好;`plugin_manifest.json` 与 `plugins.json` 均为空数组,首个内部插件的产物与签名尚未进入本仓库。
