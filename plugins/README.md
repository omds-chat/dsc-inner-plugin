# 插件目录

本目录存放索引收录的全部插件,按「作者 / 插件 / 版本」三层组织。目录名与清单字段一一对应,校验脚本对不上就报错。

本索引只收录从 DeepSeek-Chat-Enhanced 本体解耦出来的可选内部插件。条目由收录流程写入,不手工编辑;未收录插件时,`plugins.json` 为空,`plugins/` 下只有本文件、`author_manifest.json` 与已登记的作者目录。

## 作者目录

`plugins/<author>/`

- 目录名即作者英文名称,必须与 `plugins.json` 的 `author`、`plugins/author_manifest.json` 的 `username` 完全一致。
- 仅允许小写字母、数字、连字符,不得以连字符开头或结尾,最长 39 字符。
- 作者目录内有两类文件:
  - `plugin_manifest.json`:该作者的插件名数组,例如 `["dsc-demo"]`,必需。
  - `author_pub.pem`、`author_pub.<n>.pem`:作者公钥,OpenSSL PEM,Ed25519。序号与作者的签名者一一对应,`author_pub.pem` 是第 1 位签名者。

作者公钥由插件构建产物 `dist/author_pub.pem`(多签再加 `dist/author_pub.<n>.pem`)随收录流程复制进来,不要在索引里手工生成。缺失时校验只给警告,该作者的插件便不能带作者签名。

本索引的作者是 omds-chat 组织自身,作者目录为 `omds-chat`。该目录已建好,`plugin_manifest.json` 先登记待收录的 `dsc-humanize`;产物未就位时,插件目录里只有一份说明,不写 `versions.json` 与版本目录。

## 插件目录

`plugins/<author>/<plugin>/`

- 目录名取插件 npm 包名去掉命名空间前缀:`dsc-demo` 写作 `dsc-demo`,`@omds-chat/dsc-demo` 同样写作 `dsc-demo`。
- 插件名必须匹配 `dsc-xxx` 或 `@scope/dsc-xxx`,仅允许小写字母、数字、点、下划线、连字符。
- 插件目录内必需 `versions.json`:

```json
{
  "latest": "1.0.0",
  "versions": ["1.0.0", "0.9.0"]
}
```

- `latest` 必须出现在 `versions` 内;`versions` 按版本号降序排列且不得重复。
- 尚未收录的插件目录是唯一例外:只放说明,由收录脚本在建版本目录时一并写出 `versions.json`,避免预先编造版本号。

## 版本目录

`plugins/<author>/<plugin>/<x.y.z>/`

| 文件 | 必需 | 签名者 | 说明 |
|:---:|:---:|:---:|:---:|
| `meta.json` | 是 | 无 | 插件运行时元数据,字段见下表 |
| `plugin.js` | 是 | 无 | 插件运行时脚本,单文件 ESM,使用 LF 换行 |
| `plugin.js.author.sig` | 否 | 插件作者 | 第 1 位签名者对 `plugin.js` 的裸公钥分离签名,随插件产物提供 |
| `plugin.js.author.sig.<n>` | 否 | 共同签名者 | 第 n 位签名者对 `plugin.js` 的裸公钥分离签名,序号从 2 起 |

版本目录内只有作者签名,没有 `meta.json.sig` 与 `plugin.js.sig`:插件文件的整站签名在 `dist/` 里生成,由 `scripts/sign-site.mjs` 为每个 `.html/.js/.css/.json` 文件写出 `<文件>.sig`,因此 `dist/plugins/.../plugin.js.sig` 由签名阶段产出,不进入源码目录。

作者签名只覆盖 `plugin.js`:对 `meta.json` 的作者签名已取消,`meta.json` 由整站签名与索引数据覆盖。旧产物里遗留的 `meta.json.author.sig` 一律忽略,既不复制进来,也不报错。

### 作者多签命名

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

多位签名者逐位校验,任一失败只记警告、不阻断发布;校验报告里保留完整的签名者列表,便于界面展示多个签名者。

签名都是对文件原始字节的签名,不做换行规范化。任何一字节差异(包括 LF 与 CRLF 的差别)都会让校验失败。

`meta.json` 的必填字段:

| 字段 | 类型 | 说明 |
|:---:|:---:|:---:|
| `name` | string | 插件名,与 `plugins.json` 的 `plugin_name` 一致 |
| `version` | string | 三段语义化版本号,与目录名一致 |
| `license` | string | SPDX 标识符,例如 MIT |
| `description` | object | 至少包含 `zh-CN` 或 `en-US` 之一 |
| `author` | string | 作者名 |
| `repo_link` | string | 源码仓库链接 |
| `dependencies` | object | 仅允许 `dsc` 一个键,值为 semver range |

本仓库的校验只强制 `name` 与 `version`:前者必须与 `plugins.json` 的 `plugin_name` 一致,后者必须与版本目录名一致。其余字段服务于插件运行时与市场展示,索引校验不检查它们。

## 新增内部插件的步骤

收录一个内部插件分目录、清单、签名与校验四个环节,执行者各不相同:手工只改来源清单与标签,其余由收录脚本、插件构建与 CI 完成。

| 环节 | 执行者 | 写入位置 | 说明 |
|:---:|:---:|:---:|:---:|
| 目录 | CI 收录脚本 `scripts/import-plugins.mjs` | `plugins/<author>/<plugin>/<x.y.z>/` 与 `versions.json` | 目录名与版本号取自产物 `meta.json`,不手工建 |
| 清单 | 组织维护者声明来源,CI 写入清单 | `.github/plugins-sources.json`、`plugins/author_manifest.json`、`plugins/<author>/plugin_manifest.json`、`plugins.json` | 来源清单是唯一人工入口;新条目 `tag` 留空 |
| 签名 | 作者签名由插件仓库构建产出,整站签名由 CI 产出 | 版本目录的 `plugin.js.author.sig`(多签 `.author.sig.<n>`)、`plugins/<author>/author_pub.pem`、`author_pub.<n>.pem` 与 `dist/<文件>.sig`、`web_files.json`、`eec.pem` | 本仓库不生成任何签名,只接收产物并在 `dist/` 上签整站 |
| 校验 | CI 与插件市场 | 只读 | CI 跑 `pnpm verify`、`pnpm build`、`pnpm verify:site`;市场按根目录 README 的顺序复核 |

签名与校验的分工再强调一次:

- 作者签名:由插件仓库的构建完成。dsc 作为作者用 Ed25519 私钥只签 `plugin.js`,产物是 `dist/plugin.js.author.sig` 与 `dist/author_pub.pem`(多签再加 `.author.sig.<n>` 与 `author_pub.<n>.pem`);收录脚本把同名文件原样复制进版本目录与作者目录,不重新签名、不改名。
- 整站签名:由本仓库 CI 的 `scripts/sign-site.mjs` 完成,需要 `secrets.WEB_EEC_KEY` 与 `secrets.WEB_EEC_CERT`,覆盖 `dist/` 内全部 `.html`、`.js`、`.css`、`.json`。签名只落在 `dist/`,`plugins/` 源码目录不出现整站签名文件。
- 校验:索引结构与公钥材料的错误在 CI 侧阻断发布;作者签名的校验结果一律只记警告,逐位签名者给出结论,不阻断发布,与插件市场侧口径一致。

当前状态:作者目录 `plugins/omds-chat/` 与作者清单已按本规范建好,`plugin_manifest.json` 登记 `dsc-humanize`;`plugins.json` 仍为空,因为条目要求完整版本目录,产物未就位时写入会直接让校验失败。

## 目录示例

```text
plugins/
  omds-chat/
    author_pub.pem
    author_pub.2.pem
    plugin_manifest.json
    dsc-demo/
      versions.json
      1.0.0/
        meta.json
        plugin.js
        plugin.js.author.sig
        plugin.js.author.sig.2
```

源码目录不含证书:根目录只有 `meta.json`、`plugins.json`、`tags.json` 三个索引文件,含义见根目录 [README](../README.md)。网页 EEC 证书只在签名阶段进入 `dist/`,不进入源码仓库。
