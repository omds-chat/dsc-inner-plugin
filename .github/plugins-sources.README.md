# 收录来源清单

`.github/plugins-sources.json` 是 CI 收录插件时读取的唯一输入。改这个文件就是改收录结果;本索引只收录组织自研插件,由组织维护者提交 PR 修改。

文件内容是数组,每个元素描述一个插件来源。空数组表示本索引尚未收录任何插件。

## 字段

| 字段 | 类型 | 必填 | 说明 |
|:---:|:---:|:---:|:---:|
| `repo` | string | 是 | 插件源码位置。git 地址,或相对本仓库根目录的本地路径 |
| `ref` | string | 否 | git 分支、标签或提交。缺省时取远端默认分支;本地路径忽略该字段 |
| `author` | string | 是 | 作者英文名称,即 `plugins/` 下的目录名 |
| `plugin` | string | 是 | 插件名,即 `meta.json` 的 `name` |
| `profile` | string | 否 | 作者主页链接。给出时会一并登记到 `plugins/author_manifest.json` |

`author` 仅允许小写字母、数字、连字符,不得以连字符开头或结尾。`plugin` 必须匹配 `dsc-xxx` 或 `@scope/dsc-xxx`。

## 示例

以下片段只说明格式,不是已收录的插件:

```json
[
  {
    "repo": "https://github.com/omds-chat/dsc-demo",
    "ref": "v1.0.0",
    "author": "omds-chat",
    "plugin": "dsc-demo",
    "profile": "https://github.com/omds-chat"
  },
  {
    "repo": "../dsc-demo-local",
    "author": "omds-chat",
    "plugin": "dsc-demo"
  }
]
```

## 收录时会发生什么

对每一项,CI 依次执行:

1. 把 `repo` 克隆或复制到 `temp/import/`。
2. 在该目录执行 `pnpm install --frozen-lockfile` 与 `pnpm build`。
3. 读取 `dist/meta.json` 取得版本号,把 `dist/meta.json`、`dist/plugin.js` 复制到 `plugins/<author>/<plugin>/<version>/`。
4. 若 `dist/` 内存在作者签名 `plugin.js.author.sig`,原样复制到版本目录同名文件;多位签名者依次为 `plugin.js.author.sig.<序号>`(序号从 2 起),同样原样复制。
5. 若 `dist/` 内存在 `author_pub.pem` 或 `author_pub.<序号>.pem`,复制为 `plugins/<author>` 下的同名文件;序号与签名文件配对。
6. 旧产物里遗留的 `dist/meta.json.author.sig` 只提示、不复制:作者签名只覆盖 `plugin.js`,对 `meta.json` 的作者签名已取消。
7. 更新该插件的 `versions.json`、该作者的 `plugin_manifest.json`、根目录 `plugins.json`。
8. 删除 `temp/import/` 内的临时目录。

收录本身不生成任何签名。插件文件的整站签名由 `scripts/sign-site.mjs` 在构建产物 `dist/` 上生成: 每个 `.html`、`.js`、`.css`、`.json` 文件写出 `<文件>.sig`,并汇总为 `web_files.json` 与其签名。

任何一步失败,该插件被跳过并在日志中写明原因,其余插件照常处理,流程退出码保持 0。

## 收录之后

新条目在 `plugins.json` 里的 `tag` 初始为空数组。标签需要人工从根目录 `tags.json` 的预设标签中挑选后补上,校验脚本会拒绝未在 `tags.json` 中声明的标签。
