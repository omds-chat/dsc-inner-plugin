# dsc-inner-plugin

omdsc-dev 组织自研的 dsc 插件合集。插件在这里按分发规范 v2 收录、签名并分发,插件市场读取本合集的清单与公钥来取用插件。

[English](README.en-US.md)

## 定位

本仓库是一个插件合集,不是索引服务,也不提供静态站点页面: 分发内容就是合集本身,构建产物 `dist/` 直接部署到 GitHub Pages。

- 与社区合集 [awesome-dsc-plugin](https://github.com/omdsc-dev/awesome-dsc-plugin) 是兄弟仓库。两者目录结构、校验脚本与签名体系完全一致,区别只在收录范围与预设标签。
- 社区合集面向公开投稿;本合集只收录 omdsc-dev 组织自研的插件,不接受外部投稿。
- 本合集对插件的签名者标识为 `dsc-inner-plugin`。签名者标识不同,签名不能互相顶替;但两个合集都通过同一套 dsc 信任签名体系取得信任。
- 收录不等于认证。本合集只保证分发内容与签名一致,不审查插件行为。

## 当前状态

组织尚未发布可安装的同源插件,因此本合集为空合集,不含任何插件条目:

| 文件 | 内容 |
|:---:|:---:|
| `datalog.json` | `[]` |
| `plugins/author_manifest.json` | `[]` |
| `plugin_set_sign.json` | `{ "sign": [] }` |
| `plugin_secret.pub` | 占位公钥,由 CI 用 `PLUGIN_PRIVATE_KEY` 推导后覆盖 |

空合集下 `pnpm verify` 与 `pnpm build` 均通过,信任签名为空只给出警告。本仓库不编造插件条目。

## 收录条件

只有同时满足以下条件的插件才会被收录:

- 由 omdsc-dev 组织自研并维护,不接受第三方投稿。
- 承诺不采集、不外传用户凭证与数据,不隐式发起网络请求,不读取与插件功能无关的会话内容。
- 产物是单个浏览器 ESM 脚本,导出 `activate(context)`,不依赖 Node 内置模块与后端接口。
- 提供可构建的源码仓库,`pnpm build` 能在 CI 中复核产物。
- 运行时元数据 `meta.json` 字段完整,插件名符合 `dsc-xxx` 或 `@scope/dsc-xxx`。
- 维护者愿意回应使用者的问题。

不收录需要后端服务、需要原生模块、或无法在 CI 中重建产物的插件。

## 目录结构

分发规范 v2 的高耦合结构: 清单数据、公钥、签名与插件本体全部归属同站,避免跨域来源注入。

```text
dsc-inner-plugin/
├── .github/
│   ├── plugins-sources.json            收录来源清单,改这里就是改收录结果
│   ├── plugins-sources.README.md       清单字段说明
│   ├── scripts/import-plugins.mjs      按清单构建并收录插件
│   └── workflows/build-and-deploy.yml  校验、签名、提交分发内容并发布
├── .gitattributes                      统一 LF 换行
├── .gitignore
├── LICENSE
├── README.md
├── README.en-US.md
├── meta.json                           合集元数据,含下载计数开关
├── plugin_secret.pub                   合集公钥,由 CI 用私钥推导后覆盖
├── plugin_set_sign.json                dsc 对本合集的信任签名
├── datalog.json                        插件目录,以插件名称为唯一键
├── tags.json                           预设标签
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── plugins/
│   ├── author_manifest.json            登记的作者清单
│   └── <author>/
│       ├── plugin_secret.pub           该作者的公钥
│       ├── plugin_manifest.json        该作者的插件清单
│       └── <plugin>/
│           ├── versions.json           版本列表
│           └── <x.y.z>/
│               ├── meta.json           插件运行时元数据
│               ├── plugin.js           插件运行时脚本
│               └── plugin_sign.json    合集签名与作者自签名
└── scripts/
    ├── sign.mjs                        Ed25519 hash-then-sign 签名工具
    ├── lib/collection-verify.mjs       两个脚本共用的校验逻辑
    ├── build-collection.mjs            校验、签名并生成 dist/
    └── verify-collection.mjs           只读自洽性校验
```

目录命名与必需文件见 [plugins/README.md](plugins/README.md)。

## 合集元数据

根目录 `meta.json` 只声明下载计数的开关:

| 字段 | 当前值 | 说明 |
|:---:|:---:|:---:|
| `DOWNLOAD_COUNT_ENABLE` | `false` | 为 `true` 时插件市场每次下载都会向计数接口发送一次不等待回复的 POST 请求,并提示用户该来源启用了计数 |
| `DOWNLOAD_COUNT_API` | 缺省 | 计数接口地址,仅在启用计数时需要 |
| `API_NEED_IP` | `false` | 计数请求是否携带请求来源的公网 IP |

本合集当前不启用下载计数。

## 信任链

三层签名,每层只签下一层需要的东西。

| 层 | 签名者 | 私钥 | 被签名对象 | 产物 |
|:---:|:---:|:---:|:---:|:---:|
| dsc | `dsc` | dsc 私钥,不在本仓库 | 根目录 `plugin_secret.pub` 的字节 | `plugin_set_sign.json` |
| 合集 | `dsc-inner-plugin` | `PLUGIN_PRIVATE_KEY` | 每个版本的 `meta.json` 与 `plugin.js` | 版本目录内 `plugin_sign.json` |
| 作者 | 作者名 | `AUTHOR_SIGN_PRIVATE_KEY` | 同上,可选 | 追加进同一个 `plugin_sign.json` |

- 插件市场内置 dsc 公钥。校验顺序是: 先验 `plugin_set_sign.json`,通过后才信任本合集的 `plugin_secret.pub`,再用它验插件签名。
- 不支持下级派生。本合集不能为其他合集签发信任签名。
- 算法固定 Ed25519,采用 hash-then-sign: 先对文件字节做 SHA-512 摘要,再对摘要字节签名,签名以 base64 编码。
- 合集签名与作者自签名并存于同一个 `plugin_sign.json`,靠 `signer` 字段区分。校验时作者签名用 `plugins/<author>/plugin_secret.pub`,合集签名用根目录 `plugin_secret.pub`。
- 公钥总是以私钥推导结果为准。CI 用 `PLUGIN_PRIVATE_KEY` 推导后覆盖 `plugin_secret.pub`,推导结果与仓库内公钥不一致时构建直接失败。

## 收录流程

1. 提交 PR 修改 `.github/plugins-sources.json`,每个插件一项,写明 `repo`、可选的 `ref`、`author` 与 `plugin`。字段见 [plugins-sources.README.md](.github/plugins-sources.README.md)。
2. 合并后 CI 依次执行: 克隆或复制源码到 `temp/`、`pnpm install --frozen-lockfile`、`pnpm build`、把 `dist/meta.json` 与 `dist/plugin.js` 写入 `plugins/<author>/<plugin>/<version>/`、更新该插件的 `versions.json`、该作者的 `plugin_manifest.json` 与根目录 `datalog.json`。作者自签名若随产物提供会一并保留。
3. 人工补充标签。新条目在 `datalog.json` 里的 `tag` 初始为空数组,需要从 `tags.json` 的预设标签中挑选后提交。未在 `tags.json` 中声明的标签会被校验拒绝。
4. 合并并分发。CI 用 `PLUGIN_PRIVATE_KEY` 为每个版本的 `meta.json` 与 `plugin.js` 签名,合并保留作者自签名,再把 `plugins/`、`plugin_secret.pub` 与 `datalog.json` 的变更提交回仓库,同时把 `dist/` 发布到 Pages。

任何一步失败只跳过该插件并在日志里写明原因,其余插件照常处理。

## 预设标签

`tags.json` 是本合集的标签表,取组织自研视角,与社区合集的预设标签不同:

| 标签 | 含义 |
|:---:|:---:|
| `core` | 与 dsc 本体协同的基础能力 |
| `ui` | 界面与交互增强 |
| `market` | 插件市场与分发相关 |
| `tooling` | 开发、调试与构建工具 |

标签必须从 `tags.json` 中取,未声明的标签会被校验拒绝。

## 插件市场如何消费本合集

市场先读合集元数据与插件目录,再按路径取各版本文件。同一个来源通常配置多个 `base_url`,依次是自动同步的 CDN 分发服务、`raw.githubusercontent.com`、GitHub Pages,后两者做兜底,单次请求最多等待 1 秒。

| 步骤 | 路径 | 用途 |
|:---:|:---:|:---:|
| 1 | `<base_url>/meta.json` | 判断该来源是否启用下载计数 |
| 2 | `<base_url>/datalog.json` | 列出全部插件、作者与标签 |
| 3 | `<base_url>/plugins/<author>/<plugin>/versions.json` | 取版本列表与最新版本号 |
| 4 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/meta.json` | 取插件元数据 |
| 5 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/plugin.js` | 取插件运行时脚本 |
| 6 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/plugin_sign.json` | 取该版本文件的签名 |
| 7 | `<base_url>/plugin_set_sign.json` 与 `<base_url>/plugin_secret.pub` | 校验该来源可信,并取得合集公钥 |

市场把来源类型、脚本地址、公钥与签名一并存入 IndexedDB。本合集的来源类型记为 `inner`;`source_url` 存插件脚本地址;`pub` 与 `sign` 存取插件时拿到的公钥与签名,每次预运行插件前重新校验,防止篡改。

## 跨域访问

本合集托管在 GitHub Pages。Pages 对静态资源默认返回 `Access-Control-Allow-Origin: *`,因此上表中三个 `base_url` 天然可以被跨域读取,无法在托管侧把来源收窄到白名单。这是托管平台的既定行为,不是本仓库的配置。

规范要求跨域来源仅开放信任的来源,至少包含 `https://omdsc-dev.github.io`。若把分发内容改放到其他托管,需要自行配置 CORS 白名单,至少放行该来源。

## 本地校验

```bash
pnpm install
pnpm verify        # 只读自洽性校验,信任签名为空时给出警告
pnpm build         # 校验通过后生成 dist/
pnpm run import    # 按来源清单收录插件
```

- `pnpm verify` 与 `pnpm build` 在合集尚无 dsc 信任签名时按骨架模式放行并警告。配置了 dsc 公钥后可运行 `pnpm verify:strict` 做严格校验,公钥可用环境变量 `DSC_PUBLIC_KEY` 或参数 `--trust-public-key` 提供。
- 收录请用 `pnpm run import`。`pnpm import` 是 pnpm 自带命令,不是本仓库的收录脚本。
- 需要给插件签名时运行 `pnpm sign`,它会用 `PLUGIN_PRIVATE_KEY` 签名并生成 `dist/`。

## 安全提示

- 签名不通过时插件市场会警告用户并建议重新下载,不会静默运行。
- 收录不等于认证。签名只证明分发内容与签名者一致,不代表插件行为经过审查。
- 私钥只放 CI secrets 与本地环境变量,不要提交。`.gitignore` 已排除 `.env`。
- 更换合集私钥会让 dsc 已签发的信任签名全部失效,必须重新申请。
- 签名覆盖文件字节。换行、缩进或空白的任何改动都会让校验失败,仓库统一使用 LF。
- 插件产物建议行压缩,既减小体积,也避免无意义的空白差异。

## 许可

Apache License 2.0,见 [LICENSE](LICENSE)。
