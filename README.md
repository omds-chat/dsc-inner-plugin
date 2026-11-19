# dsc-inner-plugin

dsc 背书的内部插件索引: 收录从 DeepSeek-Chat-Enhanced 本体解耦出来的可选内部插件,整站由 dsc 签名发布。

[English](README.en-US.md)

## 定位

本仓库是内部插件索引,不是社区合集,也不提供额外的索引服务: 分发内容就是索引本身,构建产物 `dist/` 直接部署到 GitHub Pages。

- 收录对象是从 DeepSeek-Chat-Enhanced 本体解耦出来的可选内部插件,由 dsc 自研维护,不面向第三方投稿。
- 由 dsc 直接签名发布。市场校验本仓库时,先校验本仓库 Pages 页面的签名数据(整站 CMS 签名与 `dist/eec.pem`),再校验 dsc 作为插件作者给出的作者签名。
- 与 [awesome-dsc-plugin](https://github.com/omdsc-dev/awesome-dsc-plugin) 功能相似但结构不同: 那边是社区合集加 EEC 签插件;这边是 dsc 自己签整站,再由 dsc 作为作者签插件。
- 内部插件本身可信,但仍要走 dsc-market 的普通安装通道(软安全门禁),所以产物必须可被独立校验。
- 收录不等于认证。本仓库只保证分发内容与签名一致,不审查插件行为。

## 与 awesome-dsc-plugin 的结构差异

| 维度 | 本仓库 | awesome-dsc-plugin |
|:---:|:---:|:---:|
| 定位 | dsc 背书的内部插件索引 | 社区插件合集 |
| 收录范围 | 从 DeepSeek-Chat-Enhanced 解耦的可选内部插件,dsc 自研 | 社区投稿的第三方插件 |
| 信任来源 | dsc 网页 EEC 签整站 | 合集 EEC 签插件文件 |
| 插件文件签名 | dsc 作为作者签 `*.author.sig` | 作者自签 `*.author.sig`,合集再签 CMS |
| 版本目录文件 | `meta.json`、`plugin.js`、作者签名 | `meta.json`、`plugin.js`、两份 CMS 签名、作者签名 |
| 根目录证书 | 无,证书只出现在 `dist/` | `eec.pem` |
| 市场校验顺序 | 先验 Pages 整站签名,再验作者签名 | 先验合集 EEC 链,再验插件签名 |
| 安装通道 | dsc-market 普通通道,软安全门禁 | 同左 |

## 索引文件

索引内容全部来自数据文件与 `plugins/` 目录,没有手写的插件条目:

| 文件 | 内容 |
|:---:|:---:|
| `datalog.json` | 插件目录,每个条目的 `plugin_name` 唯一 |
| `plugins/author_manifest.json` | 已登记的作者 |
| `.github/plugins-sources.json` | 收录来源清单,空数组表示未收录插件 |
| 根目录 `eec.pem` | 不存在;网页 EEC 证书只在签名阶段写入 `dist/` |

索引为空时 `pnpm verify` 与 `pnpm build` 直接通过,不需要任何证书。签名阶段需要网页 EEC 私钥与证书: 本地缺失时只警告并保留未签名 `dist/`,CI 缺失则直接失败。本仓库不编造插件条目。

## 收录条件

只有同时满足以下条件的插件才会被收录:

- 由 omdsc-dev 组织自研并维护,不接受第三方投稿。
- 从 DeepSeek-Chat-Enhanced 本体解耦,可以单独安装、单独停用,不要求该产品本体做配套改动。
- 承诺不采集、不外传用户凭证与数据,不隐式发起网络请求,不读取与插件功能无关的会话内容。
- 产物是单个浏览器 ESM 脚本,导出 `activate(context)`,不依赖 Node 内置模块与后端接口。
- 提供可构建的源码仓库,`pnpm build` 能在 CI 中复核产物。
- 运行时元数据 `meta.json` 字段完整,插件名符合 `dsc-xxx` 或 `@scope/dsc-xxx`。
- 维护者愿意回应使用者的问题。

不收录需要后端服务、需要原生模块、或无法在 CI 中重建产物的插件。

## 签名与信任

### 两层签名

本仓库的信任由两层签名构成,两层都由 dsc 签,但覆盖的对象与作用不同。

| 层 | 签名者 | 密钥 | 覆盖对象 | 产物 |
|:---:|:---:|:---:|:---:|:---:|
| 整站签名 | dsc 网页签名方(EEC) | ECDSA P-256 | `dist/` 内全部 `.html`、`.js`、`.css`、`.json` 文件 | `<文件>.sig`、`web_files.json`、`web_files.json.sig`、`eec.pem` |
| 作者签名 | dsc(作为插件作者) | Ed25519 | 每个版本的 `meta.json` 与 `plugin.js` | `meta.json.author.sig`、`plugin.js.author.sig` |

两层都要,是因为它们回答两个不同的问题:

- 整站签名回答「这份 Pages 页面是不是 dsc 发布的」。`datalog.json`、`versions.json`、各 `meta.json` 决定市场显示什么,它们同样被签名,篡改索引会立刻让校验失败。
- 作者签名回答「这个插件文件是不是 dsc 写的」。即使文件被搬到别处、脱离本站分发,作者公钥仍然能独立校验它。

### 证书链

信任从根证书开始,一路收到网页文件的字节。

```text
omdsc-dev 根 CA(离线;root_ca.crt 由 online-data 分支分发)
  root_ca.crt
      │  签发
      ▼
dsc 网页 EEC(CI secrets:WEB_EEC_KEY / WEB_EEC_CERT)
      │  openssl cms -sign -binary -outform DER
      ▼
dist/<文件>.sig
dist/web_files.json.sig
```

| 项 | 约定 |
|:---:|:---:|
| 根 CA 密钥 | ECDSA P-256,OpenSSL 原生 PEM;浏览器 WebCrypto 对 P-256 支持最广,证书链要在浏览器里校验,Ed25519 在目标浏览器下限不可用 |
| 根证书 | X.509 自签名,`keyUsage=critical,keyCertSign,cRLSign`,`basicConstraints=critical,CA:TRUE,pathlen:0`,有效期 3650 天 |
| 网页 EEC 密钥 | ECDSA P-256 |
| 网页 EEC 证书 | 由根 CA 签发,`keyUsage=critical,digitalSignature`,`basicConstraints=critical,CA:FALSE`,有效期 365 天 |
| 整站签名 | CMS 分离签名,`openssl cms -sign -binary -outform DER -nocerts -noattr`,逐文件写出 `<文件>.sig` |
| 作者签名 | 裸公钥分离签名,`openssl pkeyutl -sign -rawin`,作者密钥为 Ed25519 |

网页 EEC 必须用 ECDSA P-256,不能用 Ed25519: OpenSSL 的 CMS 实现对 Ed25519 私钥签名报 `provider signature failure`,实测不可用。

整站签名只签 `.html`、`.js`、`.css`、`.json` 四类文件。`eec.pem` 是证书本身,由市场直接读取;作者签名 `*.author.sig` 不被整站签名覆盖,它有自己的验证链。

### 作者签名

dsc 同时是插件作者,用 Ed25519 裸公钥给每个版本的 `meta.json` 与 `plugin.js` 签名:

- 作者公钥随产物提供,收录为 `plugins/<author>/author_pub.pem`(Ed25519,OpenSSL PEM)。
- 作者的 `plugin.js.sig` 与 `meta.json.sig` 收录为 `plugin.js.author.sig` 与 `meta.json.author.sig`,文件名带 `author` 后缀,与整站签名区分。
- 作者签名是可选项,但对 dsc 自研插件是默认项。缺少作者签名时校验只警告,该版本仍受整站签名覆盖。

### 市场如何校验本来源

市场读索引、取文件、验签的顺序如下。任何一步失败只警告,不阻断,也不静默放行。

| 步骤 | 路径 | 用途 |
|:---:|:---:|:---:|
| 1 | `<base_url>/eec.pem` | 取 dsc 网页签名证书 |
| 2 | `<base_url>/web_files.json` 与 `web_files.json.sig` | 取签名清单,先校验清单签名 |
| 3 | `<base_url>/<文件>.sig` | 用清单列出的文件逐个校验 CMS 签名 |
| 4 | `<base_url>/datalog.json`、`plugins/<author>/<plugin>/versions.json`、各 `meta.json` | 索引数据,已在上一步验签,据此显示插件与版本 |
| 5 | `<base_url>/plugins/<author>/author_pub.pem` 与 `*.author.sig` | 校验插件作者签名 |
| 6 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/plugin.js` | 取运行时脚本,已在上一步验签 |

证书链的信任锚不在本仓库,而在 `online-data` 分支: 市场从 `index.json` 读取 `rootCa` 指向的 `root_ca.crt` 作为锚点,再用它校验 `dist/eec.pem`。本仓库只负责把签名数据发布到 Pages。

市场把来源类型、脚本地址、证书与签名一并缓存,本索引的来源类型记为 `inner`;证书与签名在每次预运行插件前重新校验,防止篡改。

### 软安全门禁

内部插件本身可信: 由 dsc 自研,与 DeepSeek-Chat-Enhanced 同源解耦,不经过第三方。但「可信」不等于「免检」:

- 仍然走 dsc-market 的普通安装通道,和第三方插件一样要过签名校验,没有快捷通道。
- 整站签名失败、作者签名失败或证书链不通时,市场警告用户并建议重新下载,不会静默运行。
- 门禁是软的: 失败只警告,不阻断,也不做兜底信任。是否继续由用户决定,市场不替用户做判断。

这条设计的代价是明确的: 一个被篡改的插件仍可能被用户在警告之后装上。收益同样明确: 校验链路不依赖市场对某个来源的硬编码信任,换源、镜像、离线安装都能用同一套验签逻辑。

## 目录结构

源码仓库只放索引数据与作者材料,不放任何证书。

```text
dsc-inner-plugin/
├── .github/
│   ├── plugins-sources.json            收录来源清单,改这里就是改收录结果
│   ├── plugins-sources.README.md       来源清单的字段与收录规则
│   └── workflows/build-and-deploy.yml  收录、校验、构建、整站签名并发布
├── .gitattributes                      统一 LF 换行
├── .gitignore
├── LICENSE
├── README.md
├── README.en-US.md
├── meta.json                           索引元数据,含下载计数开关
├── datalog.json                        插件目录,每个条目的 plugin_name 唯一
├── tags.json                           预设标签
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── plugins/
│   ├── author_manifest.json            登记的作者清单
│   └── <author>/
│       ├── author_pub.pem              该作者的 Ed25519 公钥
│       ├── plugin_manifest.json        该作者的插件清单
│       └── <plugin>/
│           ├── versions.json           版本列表
│           └── <x.y.z>/
│               ├── meta.json           插件运行时元数据
│               ├── meta.json.author.sig  作者裸公钥签名(可选)
│               ├── plugin.js           插件运行时脚本
│               └── plugin.js.author.sig  作者裸公钥签名(可选)
└── scripts/
    ├── pki.mjs                         OpenSSL PKI 封装,只调用命令行不做密码学
    ├── lib/collection-verify.mjs       两个脚本共用的校验逻辑
    ├── build-collection.mjs            校验并生成 dist/
    ├── verify-collection.mjs           只读自洽性校验
    ├── sign-site.mjs                   对 dist/ 做整站 CMS 签名
    ├── verify-site.mjs                 校验 dist/ 的整站签名
    └── import-plugins.mjs              按来源清单构建并收录插件
```

构建产物 `dist/` 复制根目录的 `meta.json`、`datalog.json`、`tags.json` 与 `plugins/`,并写出 `build-info.json` 作为分发索引;签名阶段再追加 `eec.pem`、每个被签名文件的 `.sig`、`web_files.json` 与 `web_files.json.sig`。

目录命名与必需文件见 [plugins/README.md](plugins/README.md)。

## 索引元数据

根目录 `meta.json` 只声明下载计数的开关:

| 字段 | 取值 | 说明 |
|:---:|:---:|:---:|
| `DOWNLOAD_COUNT_ENABLE` | `false` | 为 `true` 时插件市场每次下载都会向计数接口发送一次不等待回复的 POST 请求,并提示用户该来源启用了计数 |
| `DOWNLOAD_COUNT_API` | 缺省 | 计数接口地址,仅在启用计数时需要 |
| `API_NEED_IP` | `false` | 计数请求是否携带请求来源的公网 IP |

本索引不启用下载计数。

## 收录流程

1. 由组织维护者提交 PR 修改 `.github/plugins-sources.json`,每个插件一项,写明 `repo`、可选的 `ref`、`author` 与 `plugin`。字段与收录规则见 [.github/plugins-sources.README.md](.github/plugins-sources.README.md)。
2. 合并后 CI 依次执行: 克隆或复制源码到 `temp/import/`、`pnpm install --frozen-lockfile`、`pnpm build`、把 `dist/meta.json` 与 `dist/plugin.js` 写入 `plugins/<author>/<plugin>/<version>/`、把作者侧分离签名落为 `*.author.sig`、把 `dist/author_pub.pem` 落为 `plugins/<author>/author_pub.pem`,再更新该插件的 `versions.json`、该作者的 `plugin_manifest.json` 与根目录 `datalog.json`。
3. 人工补充标签。新条目在 `datalog.json` 里的 `tag` 初始为空数组,需要从 `tags.json` 的预设标签中挑选后提交。未在 `tags.json` 中声明的标签会被校验拒绝。
4. 构建与发布。CI 依次执行 `pnpm verify`(自洽性校验,不涉及证书链)、`pnpm build`(生成 `dist/`)、`scripts/sign-site.mjs`(用 `secrets.WEB_EEC_KEY` 做整站签名)、`scripts/verify-site.mjs`(签名自检),最后把 `dist/` 发布到 Pages。

收录环节任何一步失败只跳过该插件并在日志里写明原因,其余插件照常处理。校验、构建与签名环节失败则整个构建中止。

## 预设标签

`tags.json` 是本索引的标签表,取组织自研视角,与社区合集的预设标签不同:

| 标签 | 含义 |
|:---:|:---:|
| `core` | 与 DeepSeek-Chat-Enhanced 本体协同的基础能力 |
| `ui` | 界面与交互增强 |
| `market` | 插件市场与分发相关 |
| `tooling` | 开发、调试与构建工具 |

标签必须从 `tags.json` 中取,未声明的标签会被校验拒绝。

## 跨域访问

本索引托管在 GitHub Pages。Pages 对静态资源默认返回 `Access-Control-Allow-Origin: *`,因此上文验签步骤中的 `base_url` 天然可以被跨域读取,无法在托管侧把来源收窄到白名单。这是托管平台的既定行为,不是本仓库的配置。

规范要求跨域来源仅开放信任的来源,至少包含 `https://omdsc-dev.github.io`。若把分发内容改放到其他托管,需要自行配置 CORS 白名单,至少放行该来源。

## 本地校验

```bash
pnpm install
pnpm verify                  # 只读自洽性校验,不需要证书
pnpm build                   # 校验通过后生成 dist/
pnpm sign -- --eec web-eec.pem   # 需要 WEB_EEC_KEY,对 dist/ 做整站签名
pnpm verify:site -- --root-ca root_ca.crt   # 校验 dist/ 的整站签名
pnpm run import              # 按来源清单收录插件
```

- `pnpm verify` 与 `pnpm build` 不涉及任何证书,空索引也能直接通过。
- 整站签名需要网页 EEC 私钥。私钥用 `--key` 或环境变量 `WEB_EEC_KEY` 指定,证书用 `--eec` 或 `WEB_EEC_CERT` 指定,两者都可以是 PEM 文本或文件路径。
- 缺少私钥或证书时 `sign-site.mjs` 只警告并保留未签名 `dist/`,方便本地调试;CI 传 `--require-key`,把这种缺失当错误。
- `verify-site.mjs` 给出 `--root-ca` 时做完整证书链校验,不给时只做签名完整性校验。
- 收录请用 `pnpm run import`。`pnpm import` 是 pnpm 自带命令,不是本仓库的收录脚本。
- 本机需要 OpenSSL 3.0 及以上,脚本只调用 `openssl` 命令行,不实现任何密码学运算。

## 安全提示

- 签名不通过时插件市场会警告用户并建议重新下载,不会静默运行。
- 收录不等于认证。签名只证明分发内容与签名者一致,不代表插件行为经过审查。
- 私钥只放 CI secrets 与本地环境变量,不要提交。网页 EEC 私钥放在 `WEB_EEC_KEY`;根证书私钥永远不进本仓库,也不进 CI。`.gitignore` 已排除 `.env`。
- 更换网页 EEC 密钥对必须同时更新 `WEB_EEC_KEY` 与 `WEB_EEC_CERT`,并同步 `online-data` 分支的 `eec.pem`;旧证书签出的 CMS 签名将无法再验证。
- 签名覆盖文件字节。换行、缩进或空白的任何改动都会让校验失败,仓库统一使用 LF,作者产物也必须是 LF。
- 插件产物建议行压缩,既减小体积,也避免无意义的空白差异。

## 许可

Apache License 2.0,见 [LICENSE](LICENSE)。
