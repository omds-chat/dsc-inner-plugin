# 插件目录

本目录存放合集收录的全部插件,按「作者 / 插件 / 版本」三层组织。目录名与清单字段一一对应,校验脚本对不上就报错。

本合集只收录 omdsc-dev 组织自研的插件。组织尚未发布可安装的同源插件,因此当前目录只有本文件与空的 `author_manifest.json`。

## 作者目录

`plugins/<author>/`

- 目录名即作者英文名称,必须与 `datalog.json` 的 `author`、`plugins/author_manifest.json` 的 `username` 完全一致。
- 仅允许小写字母、数字、连字符,不得以连字符开头或结尾,最长 39 字符。
- 作者目录内必需两个文件:
  - `plugin_secret.pub`:作者公钥,SPKI PEM,Ed25519。作者启用自签名时用于校验自签名。
  - `plugin_manifest.json`:该作者的插件名数组,例如 `["dsc-demo"]`。

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

| 文件 | 必需 | 说明 |
|:---:|:---:|:---:|
| `meta.json` | 是 | 插件运行时元数据,字段见下表 |
| `plugin.js` | 是 | 插件运行时脚本,单文件 ESM,使用 LF 换行 |
| `plugin_sign.json` | 是 | 对前两个文件的签名集合,至少一条合集签名,作者自签名可选 |

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
    plugin_secret.pub
    plugin_manifest.json
    dsc-demo/
      versions.json
      1.0.0/
        meta.json
        plugin.js
        plugin_sign.json
```

合集根目录另有 `datalog.json`、`tags.json`、`meta.json`、`plugin_set_sign.json`、`plugin_secret.pub` 五个文件,含义见根目录 [README](../README.md)。
