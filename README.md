# dsc-inner-plugin

omdsc-dev 组织自研的 dsc 插件合集。插件在这里按分发规范 v2 收录、签名并分发,插件市场读取本合集的清单、终端签名证书与签名来取用插件。

[English](README.en-US.md)

## 定位

本仓库是一个插件合集,不是索引服务,也不提供静态站点页面: 分发内容就是合集本身,构建产物 `dist/` 直接部署到 GitHub Pages。

- 与社区合集 [awesome-dsc-plugin](https://github.com/omdsc-dev/awesome-dsc-plugin) 是兄弟仓库。两者目录结构、校验脚本与签名体系完全一致,区别只在收录范围与预设标签。
- 社区合集面向公开投稿;本合集只收录 omdsc-dev 组织自研的插件,不接受外部投稿。
- 两个合集都通过同一条证书链取得信任: 都由 dsce 根 CA 签发终端签名证书。证书主体不同,私钥各自持有,签名不能互相顶替。
- 收录不等于认证。本合集只保证分发内容与签名一致,不审查插件行为。

## 当前状态

组织尚未发布可安装的同源插件,因此本合集为空合集,不含任何插件条目:

| 文件 | 内容 |
|:---:|:---:|
| `datalog.json` | `[]` |
| `plugins/author_manifest.json` | `[]` |
| `.github/plugins-sources.json` | `[]` |
| `eec.pem` | 占位证书,尚未由 dsce 根 CA 签发 |

空合集下 `pnpm verify` 与 `pnpm build` 以骨架模式通过,缺少根证书与证书链只给出警告。本仓库不编造插件条目。

本合集尚未拿到 EEC: 组织目前只为 awesome-dsc-plugin 签发过终端签名证书。因此 CI 在「校验 eec.pem 证书链」这一步会失败,直到向 dsce 根 CA 申请到真实证书并覆盖 `eec.pem`。这是预期状态,不要为了跑通而跳过校验。

## 收录条件

只有同时满足以下条件的插件才会被收录:

- 由 omdsc-dev 组织自研并维护,不接受第三方投稿。
- 承诺不采集、不外传用户凭证与数据,不隐式发起网络请求,不读取与插件功能无关的会话内容。
- 产物是单个浏览器 ESM 脚本,导出 `activate(context)`,不依赖 Node 内置模块与后端接口。
- 提供可构建的源码仓库,`pnpm build` 能在 CI 中复核产物。
- 运行时元数据 `meta.json` 字段完整,插件名符合 `dsc-xxx` 或 `@scope/dsc-xxx`。
- 维护者愿意回应使用者的问题。

不收录需要后端服务、需要原生模块、或无法在 CI 中重建产物的插件。

## 签名与信任

### 三个角色

签名体系基于 OpenSSL PKI,由三个角色各持一把密钥,谁签发什么一目了然。

| 角色 | 承担者 | 持有物 | 签发对象 |
|:---:|:---:|:---:|:---:|
| 根证书机构(CA) | `dsce` 仓库 | 根私钥(离线,不入库)、根证书 | 终端签名证书 `eec.pem` |
| 终端签名方(EEC) | 本仓库 | EEC 私钥(CI secret `EEC_SECRET_KEY`)、`eec.pem` | 插件文件的 CMS 分离签名 |
| 独立签名方 | 插件作者,含 omdsc-dev 自身 | 作者密钥对 | 插件文件的裸公钥分离签名 |

### 证书链

信任从根证书开始,一路收到插件文件的字节。

```text
dsce 仓库(根 CA,离线)
  root_ca.crt
      │  签发
      ▼
  本仓库 eec.pem(终端签名证书 EEC)
      │  openssl cms -sign -binary -outform DER
      ▼
  plugins/<author>/<plugin>/<x.y.z>/meta.json.sig
  plugins/<author>/<plugin>/<x.y.z>/plugin.js.sig
```

| 项 | 约定 |
|:---:|:---:|
| 根 CA 密钥 | ECDSA P-256,OpenSSL 原生 PEM;浏览器 WebCrypto 对 P-256 支持最广,证书链要在浏览器里校验,Ed25519 在目标浏览器下限不可用 |
| 根证书 | X.509 自签名,`keyUsage=critical,keyCertSign,cRLSign`,`basicConstraints=critical,CA:TRUE,pathlen:0`,有效期 3650 天 |
| EEC 密钥 | ECDSA P-256 |
| EEC 证书 | 由根 CA 签发,`keyUsage=critical,digitalSignature`,`basicConstraints=critical,CA:FALSE`,有效期 365 天 |
| 合集签名 | CMS 分离签名,`openssl cms -sign -binary -outform DER -nocerts -noattr` |
| 作者签名 | 裸公钥分离签名,`openssl pkeyutl -sign -rawin`,作者密钥为 Ed25519 |

EEC 必须用 ECDSA P-256,不能用 Ed25519:OpenSSL 的 CMS 实现对 Ed25519 私钥签名报 `provider signature failure`,实测不可用。

### 作者自签名

插件作者是独立签名方,不经本仓库,也不依赖证书链。作者用裸公钥分离签名给插件文件签名,本仓库只负责把产物与公钥原样收录:

- 作者公钥随产物提供,收录为 `plugins/<author>/author_pub.pem`(Ed25519,OpenSSL PEM)。
- 作者的 `plugin.js.sig` 与 `meta.json.sig` 收录为 `plugin.js.author.sig` 与 `meta.json.author.sig`,与合集的 CMS 签名并存,文件名区分签名者。

作者签名是可选项。作者不签名时,该版本只有本仓库的 EEC 签名。

### 校验语义

- 本仓库发布前的校验是强校验:`pnpm verify`、`pnpm build`、CI 的每一步遇到错误都以非零退出码中止,不合规的内容不会被分发。
- 分发出去之后的校验是弱校验:插件市场对网页文件签名、插件签名、证书链校验失败只警告,不阻断,不做兜底。警告由用户决定是否继续,市场不会替用户静默放行。
- 签名覆盖文件原始字节。换行、缩进或空白的任何改动都会让校验失败,仓库统一使用 LF。

### 如何申请 EEC

本合集的 EEC 需向 dsce 根 CA 申请。EEC 证书由 dsce 仓库的根证书机构签发,本仓库不能自签,也不能为其他合集签发。

1. 本地生成 EEC 私钥与证书签名请求(CSR),`CN` 取合集名:

   ```bash
   openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out eec_secret.pem
   openssl req -new -key eec_secret.pem -out eec.csr -subj '/O=omdsc-dev/CN=dsc-inner-plugin'
   ```

2. 把 `eec.csr` 提交给 dsce 仓库(根 CA 维护方),说明用途、有效期与联系人。
3. 拿回签发好的证书,覆盖本仓库根目录的 `eec.pem`。
4. 把 `eec_secret.pem` 的内容放入 GitHub Actions secret `EEC_SECRET_KEY`,不要提交到仓库。
5. 合并后 CI 用根证书校验 `eec.pem` 的签发链,链不通、证书过期、`keyUsage` 或 `basicConstraints` 不符都会中止构建。

根证书私钥属于 dsce 仓库的离线环境,本仓库与 CI 都拿不到,也不需要。仓库内现在的 `eec.pem` 是占位证书,不是由根 CA 签发,也不能用于任何真实签名,上线前必须覆盖。

## 目录结构

分发规范 v2 的高耦合结构: 清单数据、证书、签名与插件本体全部归属同站,避免跨域来源注入。

```text
dsc-inner-plugin/
├── .github/
│   ├── plugins-sources.json            收录来源清单,改这里就是改收录结果
│   ├── plugins-sources.README.md       清单字段说明
│   └── workflows/build-and-deploy.yml  收录、校验证书链、签名、提交分发内容并发布
├── .gitattributes                      统一 LF 换行
├── .gitignore
├── LICENSE
├── README.md
├── README.en-US.md
├── eec.pem                             终端签名证书,由 dsce 根 CA 签发后覆盖
├── meta.json                           合集元数据,含下载计数开关
├── datalog.json                        插件目录,以插件名称为唯一键
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
│               ├── meta.json.sig       合集 CMS 签名
│               ├── plugin.js           插件运行时脚本
│               ├── plugin.js.sig       合集 CMS 签名
│               └── plugin.js.author.sig  作者裸公钥签名(可选)
└── scripts/
    ├── pki.mjs                         OpenSSL PKI 封装,只调用命令行不做密码学
    ├── lib/collection-verify.mjs       两个脚本共用的校验逻辑
    ├── build-collection.mjs            校验、签名并生成 dist/
    ├── verify-collection.mjs           只读自洽性校验
    └── import-plugins.mjs              按来源清单构建并收录插件
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

## 收录流程

1. 提交 PR 修改 `.github/plugins-sources.json`,每个插件一项,写明 `repo`、可选的 `ref`、`author` 与 `plugin`。字段见 [plugins-sources.README.md](.github/plugins-sources.README.md)。
2. 合并后 CI 依次执行: 克隆或复制源码到 `temp/`、`pnpm install --frozen-lockfile`、`pnpm build`、把 `dist/meta.json` 与 `dist/plugin.js` 写入 `plugins/<author>/<plugin>/<version>/`、把作者侧分离签名落为 `*.author.sig`、把 `dist/author_pub.pem` 落为 `plugins/<author>/author_pub.pem`,再更新该插件的 `versions.json`、该作者的 `plugin_manifest.json` 与根目录 `datalog.json`。
3. 人工补充标签。新条目在 `datalog.json` 里的 `tag` 初始为空数组,需要从 `tags.json` 的预设标签中挑选后提交。未在 `tags.json` 中声明的标签会被校验拒绝。
4. 合并并分发。CI 解析根证书、用 `openssl verify` 校验 `eec.pem` 链、用 `EEC_SECRET_KEY` 为每个版本的 `meta.json` 与 `plugin.js` 生成 CMS 签名、对 `dist/` 再校验一遍,然后把 `plugins/` 与 `datalog.json` 的变更提交回仓库,同时把 `dist/` 发布到 Pages。

收录环节任何一步失败只跳过该插件并在日志里写明原因,其余插件照常处理。签名与校验环节失败则整个构建中止。

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

市场先读合集元数据与插件目录,再按路径取各版本文件与签名,最后用根证书把 `eec.pem` 收进信任锚。同一个来源通常配置多个 `base_url`,依次是自动同步的 CDN 分发服务、`raw.githubusercontent.com`、GitHub Pages,后两者做兜底,单次请求最多等待 1 秒。

| 步骤 | 路径 | 用途 |
|:---:|:---:|:---:|
| 1 | `<base_url>/meta.json` | 判断该来源是否启用下载计数 |
| 2 | `<base_url>/datalog.json` | 列出全部插件、作者与标签 |
| 3 | `<base_url>/plugins/<author>/<plugin>/versions.json` | 取版本列表与最新版本号 |
| 4 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/meta.json` | 取插件元数据 |
| 5 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/plugin.js` | 取插件运行时脚本 |
| 6 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/plugin.js.sig` 与 `meta.json.sig` | 取合集 CMS 签名 |
| 7 | `<base_url>/eec.pem` | 取终端签名证书,用根证书校验证书链 |
| 8 | `<base_url>/plugins/<author>/author_pub.pem` 与 `*.author.sig` | 有作者签名时,取作者公钥与签名 |

市场把来源类型、脚本地址、证书与签名一并存入 IndexedDB。本合集的来源类型记为 `inner`;`source_url` 存插件脚本地址;证书与签名在每次预运行插件前重新校验,防止篡改。任何一项校验失败只提示警告,不阻断插件加载。

## 跨域访问

本合集托管在 GitHub Pages。Pages 对静态资源默认返回 `Access-Control-Allow-Origin: *`,因此上表中三个 `base_url` 天然可以被跨域读取,无法在托管侧把来源收窄到白名单。这是托管平台的既定行为,不是本仓库的配置。

规范要求跨域来源仅开放信任的来源,至少包含 `https://omdsc-dev.github.io`。若把分发内容改放到其他托管,需要自行配置 CORS 白名单,至少放行该来源。

## 本地校验

```bash
pnpm install
pnpm verify        # 只读自洽性校验,无根证书时证书链与签名降级为警告
pnpm build         # 校验通过后生成 dist/
pnpm run import    # 按来源清单收录插件
```

- `pnpm verify` 与 `pnpm build` 在合集尚无可用证书链时按骨架模式放行并警告,适合空合集与本地开发。拿到根证书后可做严格校验:

  ```bash
  pnpm verify:strict --root-ca root_ca.crt
  ROOT_CA_PATH=root_ca.crt pnpm verify:strict
  ```

- 收录请用 `pnpm run import`。`pnpm import` 是 pnpm 自带命令,不是本仓库的收录脚本。
- 需要给插件签名时运行 `pnpm sign --root-ca root_ca.crt`,它会用 `EEC_SECRET_KEY` 生成 CMS 签名并产出 `dist/`。私钥与 `eec.pem` 不配对、或没有提供根证书时直接失败。
- 本机需要 OpenSSL 3.0 及以上,脚本只调用 `openssl` 命令行,不实现任何密码学运算。

## 安全提示

- 签名不通过时插件市场会警告用户并建议重新下载,不会静默运行。
- 收录不等于认证。签名只证明分发内容与签名者一致,不代表插件行为经过审查。
- 私钥只放 CI secrets 与本地环境变量,不要提交。EEC 私钥放在 `EEC_SECRET_KEY`,根证书私钥永远不进本仓库。`.gitignore` 已排除 `.env`。
- 更换 EEC 密钥对必须同时换 `eec.pem` 并向 dsce 重新申请签发;旧证书签出的 CMS 签名将无法再验证。
- 签名覆盖文件字节。换行、缩进或空白的任何改动都会让校验失败,仓库统一使用 LF,作者产物也必须是 LF。
- 插件产物建议行压缩,既减小体积,也避免无意义的空白差异。

## 许可

Apache License 2.0,见 [LICENSE](LICENSE)。
