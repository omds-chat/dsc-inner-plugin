# 插件目录

本目录存放索引收录的全部插件,按「作者 / 插件 / 版本」三层组织。目录名与清单字段一一对应,校验脚本对不上就报错。

本索引只收录从 dsce 本体解耦出来的可选内部插件,当前尚无条目,因此目录里只有本文件与空的 `author_manifest.json`。

## 作者目录

`plugins/<author>/`

- 目录名即作者英文名称,必须与 `datalog.json` 的 `author`、`plugins/author_manifest.json` 的 `username` 完全一致。
- 仅允许小写字母、数字、连字符,不得以连字符开头或结尾,最长 39 字符。
- 作者目录内必需两个文件:
  - `author_pub.pem`:作者公钥,OpenSSL PEM,Ed25519。作者启用裸公钥分离签名时用于验签。
  - `plugin_manifest.json`:该作者的插件名数组,例如 `["dsc-demo"]`。

作者公钥由插件构建产物 `dist/author_pub.pem` 随收录流程复制进来,不要在索引里手工生成。缺失时校验只给警告,该作者的插件便不能带作者签名。

本索引的作者就是 dsc 组织自身,因此作者目录通常只有一个 `omdsc-dev`。

## 插件目录

`plugins/<author>/<plugin>/`

- 目录名取插件 npm 包名去掉命名空间前缀:`dsc-demo` 写作 `dsc-demo`,`@alice/dsc-demo` 同样写作 `dsc-demo`。
- 插件名必须匹配 `dsc-xxx` 或 `@scope/dsc-xxx`,仅允许小写字母、数字、点、下划线、连字符。
- 插件目录内必需 `versions.json`:

```json
{
  "latest": "1.0.0",
  "versions": ["1.0.0", "0.9.0"]
}
```

- `latest` 必须出现在 `versions` 内;`versions` 按版本号降序排列且不得重复。

## 版本目录

`plugins/<author>/<plugin>/<x.y.z>/`

| 文件 | 必需 | 签名者 | 说明 |
|:---:|:---:|:---:|:---:|
| `meta.json` | 是 | 无 | 插件运行时元数据,字段见下表 |
| `plugin.js` | 是 | 无 | 插件运行时脚本,单文件 ESM,使用 LF 换行 |
| `meta.json.author.sig` | 否 | 插件作者 | `meta.json` 的裸公钥分离签名,随插件产物提供 |
| `plugin.js.author.sig` | 否 | 插件作者 | `plugin.js` 的裸公钥分离签名,随插件产物提供 |

版本目录内不再有 `meta.json.sig` 与 `plugin.js.sig`:本索引不设「合集 EEC 签发插件」这一层。插件文件的整站签名在 `dist/` 里生成,由 `scripts/sign-site.mjs` 为每个 `.html/.js/.css/.json` 文件写出 `<文件>.sig`,因此 `dist/plugins/.../plugin.js.sig` 由构建阶段产出,不进入源码目录。

作者签名是可选项,但对 dsc 自研插件是默认项:作者不签名时,该版本只有整站签名。

签名都是对文件原始字节的签名,不做换行规范化。任何一字节差异(包括 LF 与 CRLF 的差别)都会让校验失败。

`meta.json` 的必填字段:

| 字段 | 类型 | 说明 |
|:---:|:---:|:---:|
| `name` | string | 插件名,与 `datalog.json` 的 `plugin_name` 一致 |
| `version` | string | 三段语义化版本号,与目录名一致 |
| `license` | string | SPDX 标识符,例如 MIT |
| `description` | object | 至少包含 `zh-CN` 或 `en-US` 之一 |
| `author` | string | 作者名 |
| `repo_link` | string | 源码仓库链接 |
| `dependencies` | object | 仅允许 `dsc` 一个键,值为 semver range |

## 目录示例

```text
plugins/
  omdsc-dev/
    author_pub.pem
    plugin_manifest.json
    dsc-demo/
      versions.json
      1.0.0/
        meta.json
        meta.json.author.sig
        plugin.js
        plugin.js.author.sig
```

源码目录不含证书:根目录只有 `meta.json`、`datalog.json`、`tags.json` 三个索引文件,含义见根目录 [README](../README.md)。网页 EEC 证书只在签名阶段进入 `dist/`,不进入源码仓库。
