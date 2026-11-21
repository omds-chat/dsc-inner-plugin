# dsc-inner-plugin

dsc 背书的内部插件索引: 收录从 DeepSeek-Chat-Enhanced 本体解耦出来的可选内部插件,整站由 dsc 签名发布。

[English](README.en-US.md) | [文档索引](docs/README.md)

## 定位

本仓库是内部插件索引,不是社区合集,也不提供额外的索引服务: 分发内容就是索引本身,构建产物 `dist/` 直接部署到 GitHub Pages。

- 收录对象是从 DeepSeek-Chat-Enhanced 本体解耦出来的可选内部插件,由 dsc 自研维护,不面向第三方投稿。
- 由 dsc 直接签名发布。市场校验本仓库时,先校验本仓库 Pages 页面的签名数据(整站 CMS 签名与 `dist/eec.pem`),再校验 dsc 作为插件作者给出的作者签名。
- 与 [awesome-dsc-plugin](https://github.com/omds-chat/awesome-dsc-plugin) 功能相似但结构不同: 那边是社区合集加 EEC 签插件;这边是 dsc 自己签整站,再由 dsc 作为作者签插件。
- 内部插件本身可信,但仍要走 dsc-market 的普通安装通道(软安全门禁),所以产物必须可被独立校验。
- 收录不等于认证。本仓库只保证分发内容与签名一致,不审查插件行为。

## 与 awesome-dsc-plugin 的结构差异

| 维度 | 本仓库 | awesome-dsc-plugin |
|:---:|:---:|:---:|
| 定位 | dsc 背书的内部插件索引 | 社区插件合集 |
| 收录范围 | 从 DeepSeek-Chat-Enhanced 解耦的可选内部插件,dsc 自研 | 社区投稿的第三方插件 |
| 信任来源 | dsc 网页 EEC 签整站 | 合集 EEC 签插件文件 |
| 插件文件签名 | dsc 作为作者签 `plugin.js.author.sig` | 作者自签 `*.author.sig`,合集再签 CMS |
| 版本目录文件 | `meta.json`、`plugin.js`、`plugin.js.author.sig`(可选) | `meta.json`、`plugin.js`、`plugin.js.sig`、`plugin.js.author.sig`(可选) |
| 根目录证书 | 无,证书只出现在 `dist/` | 无,证书放在 `certs/<来源 id>/` |
| 市场校验顺序 | 先验 Pages 整站签名,再验作者签名 | 先验合集 EEC 链,再验插件签名 |
| 安装通道 | dsc-market 普通通道,软安全门禁 | 同左 |

awesome 侧的版本目录只剩 `plugin.js.sig` 一份合集 CMS 签名,对 `meta.json` 的签名(`meta.json.sig`)已经取消,作者签名 `plugin.js.author.sig` 保留但可选;根目录也没有 `eec.pem`,合集证书按来源分目录放在 `certs/<来源 id>/` 下。两边的差异只在谁签插件文件,不在签名文件的数量。

## 索引文件

索引内容全部来自数据文件与 `plugins/` 目录,没有手写的插件条目:

| 文件 | 内容 |
|:---:|:---:|
| `plugins.json` | 插件目录索引,每个条目的 `plugin_name` 唯一 |
| `tags.json` | 插件标签词表,条目里的 `tag` 必须出自这里 |
| `plugins/author_manifest.json` | 已登记的作者 |
| `.github/plugins-sources.json` | 收录来源清单,空数组表示未收录插件 |
| 根目录 `eec.pem` | 不存在;网页 EEC 证书只在签名阶段写入 `dist/` |

索引为空时 `pnpm verify` 与 `pnpm build` 直接通过,不需要任何证书。签名阶段需要网页 EEC 私钥与证书: 本地缺失时只警告并保留未签名 `dist/`,CI 缺失则直接失败。本仓库不编造插件条目。

## 收录条件

只有同时满足以下条件的插件才会被收录:

- 由 omds-chat 组织自研并维护,不接受第三方投稿。
- 从 DeepSeek-Chat-Enhanced 本体解耦,可以单独安装、单独停用,不要求该产品本体做配套改动。
- 承诺不采集、不外传用户凭证与数据,不自行发起任何网络请求,不读取与插件功能无关的会话内容。这条由[产物静态扫描](#产物静态扫描)机检:命中只记警告、不阻断收录。
- 产物是单个浏览器 ESM 脚本,导出 `activate(context)`,不依赖 Node 内置模块与后端接口。
- 提供可构建的源码仓库,`pnpm build` 能在 CI 中复核产物。
- 运行时元数据 `meta.json` 字段完整,插件名符合 `dsc-xxx` 或 `@scope/dsc-xxx`。
- 插件必须先发布到 npm,且 npm 包名与插件名一致:`dsc-xxx` 对应 npm 包 `dsc-xxx`,`@scope/dsc-xxx` 对应 `@scope/dsc-xxx`。收录校验 `pnpm verify`、PR 触发的 preflight 预检作业与 CI 都会查询 npm registry,包不存在以错误拦截,PR 与 CI 双重拦截(本地无网时在线检查降级为「跳过在线检查」警告)。
- 维护者愿意回应使用者的问题。

不收录需要后端服务、需要原生模块、或无法在 CI 中重建产物的插件。

## 签名与信任

### 两层签名

本仓库的信任由两层签名构成,两层都由 dsc 签,但覆盖的对象与作用不同。

| 层 | 签名者 | 密钥 | 覆盖对象 | 产物 |
|:---:|:---:|:---:|:---:|:---:|
| 整站签名 | dsc 网页签名方(EEC) | ECDSA P-256 | `dist/` 内全部 `.html`、`.js`、`.css`、`.json` 文件 | `<文件>.sig`、`web_files.json`、`web_files.json.sig`、`eec.pem` |
| 作者签名 | dsc(作为插件作者) | Ed25519 | 每个版本的 `plugin.js` | `plugin.js.author.sig`,多签追加 `.2`、`.3` |

两层都要,是因为它们回答两个不同的问题:

- 整站签名回答「这份 Pages 页面是不是 dsc 发布的」。`plugins.json`、`versions.json`、各 `meta.json` 决定市场显示什么,它们同样被签名,篡改索引会立刻让校验失败。
- 作者签名回答「这个插件文件是不是 dsc 写的」。即使文件被搬到别处、脱离本站分发,作者公钥仍然能独立校验它。

### 证书链

信任从根证书开始,一路收到网页文件的字节。

```text
根 CA(O=omds-chat, CN=DeepSeek-Chat-Enhanced ROOT CA;离线,root_ca.crt 由 dsce 仓库的 certs 分支分发,本仓库没有该分支)
  root_ca.crt
      │  签发
      ▼
dsc 网页 EEC(O=omds-chat, CN=dsc-inner-plugin;CI secrets:DSC_INNER_PLUGIN_EEC_SECRET / DSC_INNER_PLUGIN_EEC)
      │  openssl cms -sign -binary -md sha512 -outform DER
      ▼
dist/<文件>.sig
dist/web_files.json.sig
```

| 项 | 约定 |
|:---:|:---:|
| 根 CA 密钥 | ECDSA P-256,OpenSSL 原生 PEM;浏览器 WebCrypto 对 P-256 支持最广,证书链要在浏览器里校验,Ed25519 在目标浏览器下限不可用 |
| 根证书 | X.509 自签名,主体 `O=omds-chat, CN=DeepSeek-Chat-Enhanced ROOT CA`,`keyUsage=critical,keyCertSign,cRLSign`,`basicConstraints=critical,CA:TRUE,pathlen:0`,有效期 3650 天 |
| 网页 EEC 密钥 | ECDSA P-256 |
| 网页 EEC 证书 | 由根 CA 签发,主体 `O=omds-chat, CN=dsc-inner-plugin`,`keyUsage=critical,digitalSignature`,`basicConstraints=critical,CA:FALSE`,有效期 365 天 |
| 整站签名 | CMS 分离签名,`openssl cms -sign -binary -md sha512 -outform DER -nocerts -noattr`,逐文件写出 `<文件>.sig` |
| 作者签名 | 裸公钥分离签名,`openssl pkeyutl -sign -rawin`,作者密钥为 Ed25519 |

网页 EEC 必须用 ECDSA P-256,不能用 Ed25519: OpenSSL 的 CMS 实现对 Ed25519 私钥签名报 `provider signature failure`,实测不可用。

签名与验签都显式带 `-md sha512`,不依赖 OpenSSL 的默认摘要。默认摘要随版本与发行版构建变化(OpenSSL 3.x 默认 `sha256`),一旦默认值漂移,同一份产物换个环境就验不过,而这种失败看不出原因。显式指定还能让签名与验签两侧逐字对齐,验签方不必猜签名时用了什么摘要。

整站签名只签 `.html`、`.js`、`.css`、`.json` 四类文件。`eec.pem` 是证书本身,由市场直接读取;作者签名 `plugin.js.author.sig`(多签为 `.author.sig.<序号>`)不被整站签名覆盖,它有自己的验证链。

### 作者签名

dsc 同时是插件作者,用 Ed25519 裸公钥给每个版本的 `plugin.js` 签名。按组织约定,作者签名只覆盖 `plugin.js`:对 `meta.json` 的作者签名已取消,`meta.json` 的完整性由整站签名与索引数据共同覆盖,旧产物里遗留的 `meta.json.author.sig` 一律忽略,不算错误。

- 作者公钥随产物提供,收录为 `plugins/<author>/author_pub.pem`(Ed25519,OpenSSL PEM)。
- 作者签名在产物与合集内同名,都是 `plugin.js.author.sig`,收录只做复制,不改名。
- 同一作者可以有多个签名者,按序号配对,见下节「多签命名」。
- 作者签名是可选项,但对本组织自研插件是默认项。插件仓库的构建要设置 `AUTHOR_SIGN_ENABLE=true` 并提供 `AUTHOR_SIGN_PRIVATE_KEY` 才会产出;收录时缺少作者签名只警告,该版本仍受整站签名覆盖。
- 签名文件与作者公钥按序号一对一配对,两份缺一不可。只有签名文件没有对应公钥,判为该签名者无法校验(未通过);只有公钥没有签名文件,判为该版本作者签名缺失(未校验)。两种情形都不算通过,都只记警告、不阻断发布。
- 校验按签名者逐位进行,任一失败只记警告、不阻断发布(全组织口径:签名失败只警告)。校验结果保留完整的签名者列表,市场可据此展示多个签名者。

### 多签命名

同一位作者下可以有多个签名者,例如作者本人与共同维护者各持一把 Ed25519 密钥。文件名用序号配对,序号 1 沿用既有文件名,已发布的单签产物无需改动:

| 签名者序号 | 版本目录内的签名 | 作者目录内的公钥 |
|:---:|:---:|:---:|
| 1 | `plugin.js.author.sig` | `author_pub.pem` |
| 2 | `plugin.js.author.sig.2` | `author_pub.2.pem` |
| n | `plugin.js.author.sig.<n>` | `author_pub.<n>.pem` |

- 序号从 2 起必须是十进制、不带前导零,上限 16。`plugin.js.author.sig.1`、`plugin.js.author.sig.02` 这类写法不合约定,校验只提示并忽略,不参与校验。
- 序号不必连续:某位签名者撤签时删掉自己的签名与公钥即可,其余签名者的序号不变,已发布的签名文件也不受影响。
- 用序号而不在文件名里写签名者姓名,是因为签名者姓名没有组织级注册表:写进文件名要额外维护一张映射表,还会与作者目录名、插件名在大小写与转义上纠缠;序号只依赖目录内相邻的两个文件,校验方不需要注册表,扩容时只追加一对文件。
- 兼容性:单签产物、`author_pub.pem`、历史目录结构与本文档的既有路径逐字节不变;`.author.sig` 前缀保留,按该后缀识别作者签名的工具(例如 `sign-site.mjs` 的孤儿签名清理)继续有效,新增的 `.author.sig.<序号>` 也按同一规则识别。

### 市场如何校验本来源

市场读索引、取文件、验签的顺序如下。任何一步失败只警告,不阻断,也不静默放行。

| 步骤 | 路径 | 用途 |
|:---:|:---:|:---:|
| 1 | `<base_url>/eec.pem` | 取 dsc 网页签名证书 |
| 2 | `<base_url>/web_files.json` 与 `web_files.json.sig` | 取签名清单,先校验清单签名 |
| 3 | `<base_url>/<文件>.sig` | 用清单列出的文件逐个校验 CMS 签名 |
| 4 | `<base_url>/plugins.json`、`plugins/<author>/<plugin>/versions.json`、各 `meta.json` | 索引数据,已在上一步验签,据此显示插件与版本 |
| 5 | `<base_url>/plugins/<author>/author_pub.pem`、`author_pub.<n>.pem` 与 `plugin.js.author.sig`、`.author.sig.<n>` | 逐位签名者校验插件作者签名,失败只警告 |
| 6 | `<base_url>/plugins/<author>/<plugin>/<x.y.z>/plugin.js` | 取运行时脚本,已在上一步验签 |

证书链的信任锚不在本仓库,而在 dsce(DeepSeek-Chat-Enhanced)仓库: 根证书与公钥放在它的 `certs` 分支,信任清单放在它的 `trusted-manifest` 分支;市场按信任清单里 `rootCa` 指向的位置取到 `root_ca.crt` 作为锚点,再用它校验本仓库 Pages 上的 `dist/eec.pem`。本仓库只负责把签名数据发布到 Pages,既没有 `certs` 分支,也没有 `trusted-manifest` 分支。

市场把来源类型、脚本地址、证书与签名一并缓存,本索引的来源类型记为 `inner`;证书与签名在每次预运行插件前重新校验,防止篡改。

### 软安全门禁

内部插件本身可信: 由 dsc 自研,与 DeepSeek-Chat-Enhanced 同源解耦,不经过第三方。但「可信」不等于「免检」:

- 仍然走 dsc-market 的普通安装通道,和第三方插件一样要过签名校验,没有快捷通道。
- 整站签名失败、作者签名失败或证书链不通时,市场警告用户并建议重新下载,不会静默运行。
- 门禁是软的: 失败只警告,不阻断,也不做兜底信任。是否继续由用户决定,市场不替用户做判断。

这条设计的代价是明确的: 一个被篡改的插件仍可能被用户在警告之后装上。收益同样明确: 校验链路不依赖市场对某个来源的硬编码信任,换源、镜像、离线安装都能用同一套验签逻辑。

## 产物静态扫描

收录与发布前会静态扫描每个版本的 `plugin.js`,列出自行发起网络的写法。这是「插件不得自建网络通道」这条契约的机检部分: 检查落在收录与发布侧,不在运行侧,命中只警告、不阻断,装好之后的运行行为不由本仓库负责。

| 规则 | 命中的写法 | 发起的是什么 |
|:---:|:---:|:---:|
| 全局 `fetch` | `fetch(`、`window.fetch(`、`globalThis.fetch(`、`self.fetch(` | HTTP 请求 |
| `XMLHttpRequest` | `XMLHttpRequest(` | HTTP 请求,旧式写法 |
| `WebSocket` | `WebSocket(` | 长连接 |
| `EventSource` | `EventSource(` | 服务端推送长连接 |
| `navigator.sendBeacon` | `navigator.sendBeacon(` | 页面卸载时的上报 |
| 远程动态导入 | `import('https://...')`、`import('//...')` | 从站外取代码 |

判定与输出:

- 命中报错误码 `PLUGIN_NETWORK_SELFTALK`,消息给出命中的字面量与「第 N 行第 M 列」,`problems[].path` 指向该 `plugin.js`。
- 命中只记警告: `pnpm verify` 与 `pnpm build` 照常通过,后者照常写出 `dist/`;`pnpm run import` 照常收录该插件。`pnpm verify --json` 里这条问题的 `level` 是 `warning`。
- 这是警告而不是阻断,与作者签名的结论同一口径: 扫描只读文本、不做语法分析,误伤面无法压到零,因此把判断留给维护者。警告不等于合规,命中项仍应在收录前复核并改写。

误伤与规避:

- 只认全局对象上的直接调用: `fetch(` 前面不是点号,或者点号前面是 `window`、`globalThis`、`self`、`global`。`client.fetch(...)`、`this.fetch(...)`、`params.fetch(...)` 都不命中。
- 只有标识符后面跟着左括号才算调用;单纯取引用不命中,例如 `const f = fetch`。
- 扫描不做语法分析,注释、字符串与模板字面量里的同形文字照样命中。已知误伤有两类: 对象字面量里定义同名方法(`fetch(path) { ... }`)与文案里写到这个词。规避方式是改名(例如方法叫 `request`)或改写那段文字,不要为了绕开扫描去拆散写法。
- 已知盲区: 间接写法拦不住,例如先 `const f = fetch` 再调用、`globalThis['fetch']`、可选链 `window?.fetch(`、换名的 XHR 包装。扫描是收录侧的提示,不是沙箱;契约靠同一份代码评审兜住,不要用变体写法绕过。
- 只扫 `plugin.js`;作者签名文件与 `meta.json` 不含可执行代码,不扫。

规则表与实现同在 [scripts/lib/plugin-network-scan.mjs](scripts/lib/plugin-network-scan.mjs),扫描不联网、不读证书: `pnpm verify --json` 的 `problems[].code` 取值为 `PLUGIN_NETWORK_SELFTALK`。

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
├── plugins.json                        插件目录索引,每个条目的 plugin_name 唯一
├── tags.json                           预设标签
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── plugins/
│   ├── author_manifest.json            登记的作者清单
│   └── <author>/
│       ├── author_pub.pem              第 1 位签名者的 Ed25519 公钥
│       ├── author_pub.<n>.pem          第 n 位签名者的公钥(可选)
│       ├── plugin_manifest.json        该作者的插件清单
│       └── <plugin>/
│           ├── versions.json           版本列表
│           └── <x.y.z>/
│               ├── meta.json           插件运行时元数据
│               ├── plugin.js           插件运行时脚本
│               └── plugin.js.author.sig  作者裸公钥签名(可选,多签追加 .2、.3)
└── scripts/
    ├── pki.mjs                         OpenSSL PKI 封装,只调用命令行不做密码学
    ├── lib/collection-verify.mjs       两个脚本共用的校验逻辑
    ├── lib/plugin-network-scan.mjs     产物静态扫描:插件不得自建网络通道
    ├── build-collection.mjs            校验并生成 dist/
    ├── verify-collection.mjs           只读自洽性校验
    ├── sign-site.mjs                   对 dist/ 做整站 CMS 签名
    ├── verify-site.mjs                 校验 dist/ 的整站签名
    └── import-plugins.mjs              按来源清单构建并收录插件
```

构建产物 `dist/` 复制根目录的 `meta.json`、`plugins.json`、`tags.json` 与 `plugins/`,并写出 `build-info.json` 作为分发索引;签名阶段再追加 `eec.pem`、每个被签名文件的 `.sig`、`web_files.json` 与 `web_files.json.sig`。

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
2. 合并后 CI 依次执行: 克隆或复制源码到 `temp/import/`、`pnpm install --frozen-lockfile`、`pnpm build`、把 `dist/meta.json` 与 `dist/plugin.js` 写入 `plugins/<author>/<plugin>/<version>/`、把 `dist/plugin.js.author.sig`(多签 `.author.sig.<序号>`)原样复制到版本目录、把 `dist/author_pub.pem` 与 `author_pub.<序号>.pem` 复制为 `plugins/<author>/` 下的同名文件,再更新该插件的 `versions.json`、该作者的 `plugin_manifest.json` 与根目录 `plugins.json`。产物 `dist/plugin.js` 在搬进版本目录之前先过静态扫描: 命中 `PLUGIN_NETWORK_SELFTALK` 只记警告,收录照常继续。
3. 人工补充标签。新条目在 `plugins.json` 里的 `tag` 初始为空数组,需要从 `tags.json` 的预设标签中挑选后提交。未在 `tags.json` 中声明的标签会被校验拒绝;`tags.json` 缺失同样判为错误,发布中止。
4. 构建与发布。CI 依次执行 `pnpm verify`(自洽性校验与产物静态扫描,不涉及证书链)、`pnpm build`(生成 `dist/`)、`scripts/sign-site.mjs`(用 `secrets.DSC_INNER_PLUGIN_EEC_SECRET` 做整站签名)、`scripts/verify-site.mjs`(签名自检),最后把 `dist/` 发布到 Pages。

收录环节任何一步失败只跳过该插件并在日志里写明原因,其余插件照常处理。校验、构建与签名环节失败则整个构建中止。

## 新增内部插件的步骤

收录一个内部插件分目录、清单、签名与校验四个环节,执行者不同:本仓库的人工改动只有来源清单、标签与文档,其余由收录脚本、插件仓库构建与 CI 完成。

| 环节 | 执行者 | 写入位置 | 触发方式 |
|:---:|:---:|:---:|:---:|
| 目录 | CI 收录脚本 | `plugins/<author>/<plugin>/<x.y.z>/` 与 `versions.json` | `node scripts/import-plugins.mjs --manifest .github/plugins-sources.json` |
| 清单 | 组织维护者声明来源,CI 写入清单 | `.github/plugins-sources.json`、`plugins/author_manifest.json`、`plugins/<author>/plugin_manifest.json`、`plugins.json` | 维护者 PR 后由同一次收录写入;标签人工补 |
| 签名 | 作者签名由插件仓库构建完成,整站签名由 CI 完成 | 版本目录的 `plugin.js.author.sig`(多签 `.author.sig.<序号>`)与 `plugins/<author>/author_pub.pem`、`author_pub.<序号>.pem`;`dist/<文件>.sig`、`web_files.json`、`eec.pem` | 收录时复制产物签名;签名步骤用 `secrets.DSC_INNER_PLUGIN_EEC_SECRET` 与 `secrets.DSC_INNER_PLUGIN_EEC` 执行 `scripts/sign-site.mjs` |
| 校验 | CI 与插件市场 | 只读 | CI 依次跑 `pnpm verify`、`pnpm build`、`pnpm verify:site`;市场按「市场如何校验本来源」复核 |

具体到一次 PR:

1. 组织维护者在 `.github/plugins-sources.json` 增加一项,写 `repo`、可选 `ref`、`author` 与 `plugin`,可附 `profile` 登记作者主页。字段见 [.github/plugins-sources.README.md](.github/plugins-sources.README.md)。
2. 合并后由 CI 收录:建版本目录、复制 `dist/meta.json` 与 `dist/plugin.js`、把 `dist/plugin.js.author.sig`(多签 `.author.sig.<序号>`)原样复制到版本目录、把 `dist/author_pub.pem` 与 `author_pub.<序号>.pem` 复制为 `plugins/<author>/` 下的同名文件,再更新 `versions.json`、`plugin_manifest.json`、`author_manifest.json` 与 `plugins.json`。
3. 组织维护者从 `tags.json` 挑标签补进 `plugins.json`;未在 `tags.json` 声明的标签会被校验拒绝,`tags.json` 缺失也会让校验与构建中止。
4. CI 校验并签名:`pnpm verify` 通过后 `pnpm build` 生成 `dist/`,再用 `scripts/sign-site.mjs` 做整站签名,最后由 `scripts/verify-site.mjs` 自检,全部通过才发布 Pages。

目录与清单不手写。产物就位前把条目写进 `plugins.json` 会让校验失败,因为每个条目都要求完整的版本目录;作者公钥与作者签名也只在产物存在时才有,索引里不生成。当前 `dsc-humanize` 只建到作者目录与作者清单,`plugins.json` 仍为空,产物与签名都没有进入本仓库。规则与占位说明见 [plugins/README.md](plugins/README.md)。

## 预设标签

`tags.json` 是本索引的标签表,取组织自研视角,与社区合集的预设标签不同:

| 标签 | 含义 |
|:---:|:---:|
| `core` | 与 DeepSeek-Chat-Enhanced 本体协同的基础能力 |
| `ui` | 界面与交互增强 |
| `market` | 插件市场与分发相关 |
| `tooling` | 开发、调试与构建工具 |

标签必须从 `tags.json` 中取,未声明的标签会被校验拒绝。

`tags.json` 与 `meta.json`、`plugins.json` 同为根目录必需文件。缺词表时「标签必须出自预设词表」这条校验会整段失效,因此缺文件判为 `TAGS_MISSING` 错误: `pnpm verify` 失败,`pnpm build` 在写出 `dist/` 之前中止,不降级为警告。空词表与缺词表不同: 空数组仍会执行校验,任何非空标签都会被 `TAG_NOT_DECLARED` 拒绝。

| 错误码 | 级别 | 触发条件 | 处理 |
|:---:|:---:|:---:|:---:|
| `TAGS_MISSING` | 错误 | 根目录没有 `tags.json` | 补回词表;校验与构建均中止 |
| `TAGS_INVALID` | 错误 | 顶层不是字符串数组,或含空字符串项 | 按词表格式修 `tags.json` |
| `TAGS_DUPLICATE` | 警告 | 词表内出现重复标签 | 去重;不阻断发布 |
| `TAG_NOT_DECLARED` | 错误 | `plugins.json` 条目的标签不在词表内 | 改标签,或先扩词表再提交 |

四者都由 `scripts/lib/collection-verify.mjs` 产出,`pnpm verify --json` 的 `problems[].code` 与上表一致。词表本身不是合法 JSON 时归入 `JSON_INVALID`,文件存在但读取失败时归入 `FILE_UNREADABLE`,两者同样是错误。

## 跨域访问

本索引托管在 GitHub Pages。Pages 对静态资源默认返回 `Access-Control-Allow-Origin: *`,因此上文验签步骤中的 `base_url` 天然可以被跨域读取,无法在托管侧把来源收窄到白名单。这是托管平台的既定行为,不是本仓库的配置。

规范要求跨域来源仅开放信任的来源,至少包含 `https://omds-chat.github.io`。若把分发内容改放到其他托管,需要自行配置 CORS 白名单,至少放行该来源。

## 本地校验

```bash
pnpm install
pnpm verify                  # 只读自洽性校验,不需要证书
pnpm build                   # 校验通过后生成 dist/
pnpm sign -- --eec web-eec.pem   # 需要 DSC_INNER_PLUGIN_EEC_SECRET,对 dist/ 做整站签名
pnpm verify:site -- --root-ca root_ca.crt   # 校验 dist/ 的整站签名
pnpm run import              # 按来源清单收录插件
```

- `pnpm verify` 与 `pnpm build` 不涉及任何证书,空索引也能直接通过;两者都会静态扫描每个版本的 `plugin.js`,命中 `PLUGIN_NETWORK_SELFTALK` 只记警告、不影响退出码,规则与误伤说明见[产物静态扫描](#产物静态扫描)。
- 根目录必需文件为 `meta.json`、`plugins.json`、`tags.json`;缺任一项都以错误结束,其中缺 `tags.json` 的错误码是 `TAGS_MISSING`。
- 整站签名需要网页 EEC 私钥。私钥用 `--key` 或环境变量 `DSC_INNER_PLUGIN_EEC_SECRET` 指定,证书用 `--eec` 或 `DSC_INNER_PLUGIN_EEC` 指定,两者都可以是 PEM 文本或文件路径。
- 缺少私钥或证书时 `sign-site.mjs` 只警告并保留未签名 `dist/`,方便本地调试;CI 传 `--require-key`,把这种缺失当错误。
- `verify-site.mjs` 给出 `--root-ca` 时做完整证书链校验,不给时只做签名完整性校验。
- 收录请用 `pnpm run import`。`pnpm import` 是 pnpm 自带命令,不是本仓库的收录脚本。
- 要产出作者签名,收录环境需设置 `AUTHOR_SIGN_ENABLE=true` 与 `AUTHOR_SIGN_PRIVATE_KEY`,收录脚本只把这两个变量透传给插件构建、不读取私钥内容;开启但没有私钥时如实降级为不签名并警告,收录照常继续。
- 作者签名失败与产物静态扫描命中都只记警告,不让 `pnpm verify` 或 `pnpm build` 失败;只有索引结构与公钥材料出错才阻断。
- 本地需要 OpenSSL 3.0 及以上,脚本只调用 `openssl` 命令行,不实现任何密码学运算。

## 安全提示

- 签名不通过时插件市场会警告用户并建议重新下载,不会静默运行。
- 收录不等于认证。签名只证明分发内容与签名者一致,不代表插件行为经过审查。
- 私钥只放 CI secrets 与本地环境变量,不要提交。网页 EEC 私钥放在 `DSC_INNER_PLUGIN_EEC_SECRET`;作者私钥放在插件仓库侧的 `AUTHOR_SIGN_PRIVATE_KEY`,本仓库只透传给插件构建,收录、校验与整站签名都不使用它;根证书私钥永远不进本仓库,也不进 CI。`.gitignore` 已排除 `.env`。
- 更换网页 EEC 密钥对必须同时更新 `DSC_INNER_PLUGIN_EEC_SECRET` 与 `DSC_INNER_PLUGIN_EEC`,并由组织在 dsce 仓库的 `certs` 分支同步 `eec.pem`(本仓库不存放该证书);旧证书签出的 CMS 签名将无法再验证。
- 签名覆盖文件字节。换行、缩进或空白的任何改动都会让校验失败,仓库统一使用 LF,作者产物也必须是 LF。
- 插件产物建议行压缩,既减小体积,也避免无意义的空白差异。

## 许可

Apache License 2.0,见 [LICENSE](LICENSE)。
