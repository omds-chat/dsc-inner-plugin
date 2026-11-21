# Pages 发布内容职责

> 面向本仓库的维护者与接手者。本文只回答一件事: `dist/` 里的每份产物由谁生成、由谁读取、是否进入整站签名、体积随什么增长。机制与信任边界见 [收录与作者签名](collection-and-author-signing.md),索引目录规范见 [plugins/README.md](../../plugins/README.md),操作步骤见根目录 [README](../../README.md)。

## 一、判定口径

`dist/` 是唯一发布内容,它的文件来自三个互不重叠的来源:

| 来源 | 动作 | 产物 |
|:---:|:---:|:---:|
| 构建阶段 `scripts/build-collection.mjs` | 校验合集后复制与写出 | 根索引三件、`plugins/` 整树、`build-info.json` |
| 签名阶段 `scripts/sign-site.mjs` | 对 `dist/` 就地签名 | 逐文件 `.sig`、`web_files.json` 与其 `.sig`、`eec.pem` |
| 收录阶段的产物搬运 | `scripts/import-plugins.mjs` 此前写入源码树,构建时随目录整树搬入 | 版本目录、作者签名、作者公钥 |

签名覆盖面只由两条规则决定,不看文件用途:

| 判定 | 依据 | 结论 |
|:---:|:---:|:---:|
| 扩展名属于 `.html`、`.js`、`.css`、`.json` | [pki.mjs:51](../../scripts/pki.mjs) | 进入覆盖面 |
| 文件名等于 `web_files.json` | [sign-site.mjs:110](../../scripts/sign-site.mjs) | 排除,清单自身单独签名 |
| 扩展名为 `.sig`、`.pem`、`.md` | 不在覆盖面内 | 不参与整站签名 |

因此「参与整站签名」是扩展名的副产物,不是逐文件判断出来的。同一份素材换个扩展名,签发结论就会变。

体积有两个口径,不可混用:

- 签名文件与源文件大小无关。整站签名是 CMS 分离签名,固定 `-binary -md sha512 -outform DER -nocerts -noattr`([pki.mjs:365](../../scripts/pki.mjs)),单份只有签名值与算法标识;作者签名是 Ed25519 裸公钥签名([pki.mjs:442](../../scripts/pki.mjs)),长度同样与被签消息无关。
- 索引类 JSON 的体积由条目数决定,与文件内容长度无关。

## 二、面向宿主侧

这一组是市场与引擎按既有读取顺序直接取用的文件。读取顺序见 [README.md:136](../../README.md) 起的市场校验表: 证书与签名在前,索引数据在中,运行时脚本在最后。

| 路径 | 生成者 | 消费者 | 整站签名 | 体积随什么增长 |
|:---:|:---:|:---:|:---:|:---:|
| `dist/meta.json` | 人写根目录 `meta.json`;构建原样复制([build-collection.mjs:21](../../scripts/build-collection.mjs)) | 市场(下载计数开关);自洽性校验读同一份字段([collection-verify.mjs:139](../../scripts/lib/collection-verify.mjs)) | 参与(`.json`) | 恒定: 合集级开关字段,与插件数无关(启用计数时多一个接口地址) |
| `dist/plugins.json` | 收录脚本写入条目([import-plugins.mjs:266](../../scripts/import-plugins.mjs));`tag` 由维护者手工补 | 市场(决定显示哪些插件);自洽性校验([collection-verify.mjs:180](../../scripts/lib/collection-verify.mjs));构建统计条目数([build-collection.mjs:87](../../scripts/build-collection.mjs)) | 参与(`.json`) | 与插件条目数线性: 每条含插件名、作者、标签数组 |
| `dist/plugins/<作者>/<插件>/versions.json` | 收录脚本([import-plugins.mjs:246](../../scripts/import-plugins.mjs)) | 市场(版本列表);自洽性校验([collection-verify.mjs:343](../../scripts/lib/collection-verify.mjs));构建汇总版本数([build-collection.mjs:101](../../scripts/build-collection.mjs)) | 参与(`.json`) | 与该插件历史版本数线性: 每个版本号一条 |
| `dist/plugins/<作者>/<插件>/<x.y.z>/meta.json` | 插件仓库构建产出,收录原样复制([import-plugins.mjs:393](../../scripts/import-plugins.mjs)) | 市场(插件展示与运行时元数据);自洽性校验核对 `name` 与 `version`([collection-verify.mjs:399](../../scripts/lib/collection-verify.mjs)) | 参与(`.json`) | 恒定: 随插件自身字段规模,与版本数无关 |
| `dist/plugins/<作者>/<插件>/<x.y.z>/plugin.js` | 插件仓库构建产出,收录原样复制([import-plugins.mjs:394](../../scripts/import-plugins.mjs)) | 市场(预运行插件时的运行时脚本) | 参与(`.js`),同时受作者签名覆盖 | 插件自身代码体积,与索引规模无关 |
| `dist/plugins/<作者>/<插件>/<x.y.z>/plugin.js.author.sig`、`.author.sig.<n>` | 插件仓库构建,收录原样复制([import-plugins.mjs:403](../../scripts/import-plugins.mjs)) | 市场(逐位签名者校验作者归属);自洽性校验([collection-verify.mjs:447](../../scripts/lib/collection-verify.mjs)) | 不参与(`.sig`),且不属于整站签名: 孤儿签名清理会跳过它([sign-site.mjs:193](../../scripts/sign-site.mjs)) | 与签名者人数线性: 单份长度固定,与被签的 `plugin.js` 体积无关 |
| `dist/plugins/<作者>/author_pub.pem`、`author_pub.<n>.pem` | 插件仓库构建,收录原样复制([import-plugins.mjs:409](../../scripts/import-plugins.mjs)) | 市场(验作者签名);自洽性校验([collection-verify.mjs:287](../../scripts/lib/collection-verify.mjs)) | 不参与(`.pem`) | 与签名者人数线性: 单份是一把 Ed25519 公钥,长度固定 |

三点补充:

- 根 `meta.json` 与版本 `meta.json` 同名不同职。前者是索引级开关(下载计数),由本仓库维护;后者是单版本插件元数据,只能来自插件仓库的构建产物。二者在 `dist/` 里层级不同,但同名,读文件时看路径不看文件名。
- 在插件目录这一层,作者公钥与作者签名是「宿主读取却不参与整站签名」的一组(同类还有 `eec.pem`,见第四节)。它们的锚点在自身([collection-and-author-signing.md 第 9.4 节](collection-and-author-signing.md)记录了这一状态未定稿)。
- `plugin.js` 被两层覆盖: 字节由整站签名固定,归属由作者签名回答。两层都不通过时,前者阻断发布,后者只警告。

## 三、面向第三方工具与作者自查

这一组是给人和工具看的索引与统计,不是宿主安装通道。它们参与整站签名,是因为扩展名落在覆盖面内,而不是因为宿主会读。

| 路径 | 生成者 | 消费者 | 整站签名 | 体积随什么增长 |
|:---:|:---:|:---:|:---:|:---:|
| `dist/build-info.json` | 构建阶段由索引汇总写出([build-collection.mjs:131](../../scripts/build-collection.mjs)) | 仓库内没有任何消费者;本仓库文档记载的市场读取顺序也不含它 | 参与(`.json`) | 与作者数、插件数、各插件版本数之和线性: 每个插件一条,带 `latest` 与完整版本数组 |
| `dist/tags.json` | 人写根目录 `tags.json`;构建原样复制([build-collection.mjs:21](../../scripts/build-collection.mjs)) | 维护者挑标签(收录流程第三步);自洽性校验用它拒绝未声明标签([collection-verify.mjs:157](../../scripts/lib/collection-verify.mjs)) | 参与(`.json`) | 与预设标签条数线性: 每条一个字符串 |
| `dist/plugins/author_manifest.json` | 收录脚本在来源项给出 `profile` 时写入([import-plugins.mjs:288](../../scripts/import-plugins.mjs)),也可手改 | 自洽性校验(登记与重复检查,[collection-verify.mjs:224](../../scripts/lib/collection-verify.mjs)) | 参与(`.json`) | 与作者数线性: 每位作者一条用户名与主页 |
| `dist/plugins/<作者>/plugin_manifest.json` | 收录脚本([import-plugins.mjs:256](../../scripts/import-plugins.mjs)) | 自洽性校验(交叉核对 `plugins.json` 条目是否在该作者名下,[collection-verify.mjs:307](../../scripts/lib/collection-verify.mjs)) | 参与(`.json`) | 与该作者的插件数线性 |
| `dist/plugins/README.md`、`dist/plugins/<作者>/<插件>/README.md` | 人手写,构建随 `plugins/` 整树复制([build-collection.mjs:130](../../scripts/build-collection.mjs)) | 只用浏览器看的人;没有任何脚本读取 | 不参与(`.md`) | 人工文本: 与索引规模无关,但每多一个插件目录就多一份 |

`build-info.json` 的字段值得单独说明,它只做统计,不做分发:

| 字段 | 含义 | 与索引数据的关系 |
|:---:|:---:|:---:|
| `collection` | 合集名,默认取合集目录名,可用 `--collection-name` 覆盖 | 不来自任何索引文件 |
| `plugin_count` | `plugins.json` 中合格条目数 | `plugins.json` 的派生量 |
| `author_count` | 上述条目的去重作者数 | `plugins.json` 的派生量 |
| `plugins` | 每项 `{ name, author, latest, versions }` | `plugins.json` 加各 `versions.json` 的派生量 |

它是唯一一份「把索引数据再抄一遍」的产物: 同样的信息已经分别存在于 `plugins.json` 与 `versions.json`,而这两份才是宿主读取的那一份。它没有 schema 版本号,也没有任何校验脚本读取它,因此不能作为对外契约使用。

## 四、面向站点自身

这一组回答「这份页面是不是本组织发布的」。它们不由构建阶段产出,而是签名阶段在已定型的 `dist/` 上就地生成。

| 路径 | 生成者 | 消费者 | 整站签名 | 体积随什么增长 |
|:---:|:---:|:---:|:---:|:---:|
| `dist/<文件>.sig`(每个 `.html`、`.js`、`.css`、`.json`) | 签名阶段逐文件生成([sign-site.mjs:205](../../scripts/sign-site.mjs)) | 签名自检([verify-site.mjs:159](../../scripts/verify-site.mjs));市场按清单逐个校验 | 它就是整站签名本身,但不签自己 | 单份固定,与源文件大小无关;总份数等于被签名文件数 |
| `dist/web_files.json` | 签名阶段写出([sign-site.mjs:210](../../scripts/sign-site.mjs)),内容为 `{ schemaVersion, files }` | 签名自检([verify-site.mjs:142](../../scripts/verify-site.mjs));市场先验清单再验逐文件签名 | 不在自己的 `files` 内;单独签一份 `.sig` | 与被签名文件数线性: 每份一行路径 |
| `dist/web_files.json.sig` | 签名阶段对清单单独签名([sign-site.mjs:212](../../scripts/sign-site.mjs)) | 签名自检([verify-site.mjs:145](../../scripts/verify-site.mjs));市场 | 它就是清单的签名,不签自己 | 固定 |
| `dist/eec.pem` | 签名阶段从 `--eec` 或 `DSC_INNER_PLUGIN_EEC` 复制([sign-site.mjs:214](../../scripts/sign-site.mjs));证书本身由离线环节签发,本仓库不产证书 | 市场(取证书、验到根证书);签名自检的证书链入口([verify-site.mjs:119](../../scripts/verify-site.mjs)) | 不参与(`.pem`,信任材料不进清单) | 固定: 单张证书 |

清单与逐文件签名是同一件事的两半,顺序不能换:

- 先签每个目标文件,再写清单,最后签清单([sign-site.mjs:205](../../scripts/sign-site.mjs) 至 [sign-site.mjs:212](../../scripts/sign-site.mjs))。清单记录的是这一轮实际签过哪些文件,不是目录里有什么文件。
- 自检两个方向都查: 清单列出的文件必须存在且签名通过,目录内的签名目标必须都出现在清单里([verify-site.mjs:149](../../scripts/verify-site.mjs) 至 [verify-site.mjs:166](../../scripts/verify-site.mjs))。
- 孤儿签名在签名前清理,只清 `<文件>.sig`,跳过作者签名([sign-site.mjs:192](../../scripts/sign-site.mjs) 至 [sign-site.mjs:199](../../scripts/sign-site.mjs))。这条跳过规则是作者签名层与整站签名层唯一会互相看见的地方。

`eec.pem` 不在覆盖面内是刻意的: 它由市场直接读取并验到根证书,而根证书不在本仓库: 证书与公钥放在 dsce 仓库的 `certs` 分支,信任清单放在 dsce 仓库的 `trusted-manifest` 分支,清单里的 `rootCa` 指向根证书。本仓库只发布签名数据,信任锚不随本仓库发布。

## 五、宿主通道与统计清单的分界

一句话分界: 宿主读的东西决定「装什么」,统计清单只描述「装了多少」。

| 角色 | 文件 | 判据 |
|:---:|:---:|:---:|
| 宿主通道 | 根 `meta.json`、`plugins.json`、各 `versions.json`、各版本 `meta.json`、`plugin.js`、作者签名与作者公钥、`eec.pem`、`web_files.json` 与逐文件 `.sig` | 出现在市场读取顺序中,被读取即被使用 |
| 统计清单 | `build-info.json`、`tags.json`、`author_manifest.json`、`plugin_manifest.json`、各 `README.md` | 不改变宿主的安装与显示结果 |

四条支撑这个分界的理由:

- `build-info.json` 的每个字段都能从 `plugins.json` 与 `versions.json` 现场算出,不携带新事实。它重复的那两份文件已经被整站签名覆盖,再加一份副本只会多一处可能不同步的位置。
- `tags.json` 是标签词表,不是标签数据。标签本身写在 `plugins.json` 条目的 `tag` 数组里,宿主读的是那一份;词表只用于发布前拒绝未声明标签。
- `author_manifest.json` 与 `plugin_manifest.json` 是索引自洽的中间材料,自洽性校验读它们,宿主不需要: 市场从 `plugins/<作者>/` 的目录结构和 `versions.json` 就能定位文件。
- 统计清单与统计口径一旦被当作宿主契约,就不能再自由增删字段。保持「不是通道」这一点,等于保住了改动它们时不必兼容旧版本的自由。

## 六、当前体量与覆盖实测

以下数字取自当前工作区的只读盘点,用于给出量级,不是规格:

| 项 | 实测 | 说明 |
|:---:|:---:|:---:|
| `dist/` 文件总数(签名前) | 8 | 6 个 JSON、2 个 Markdown |
| 被整站签名的目标数 | 6 | `verify-site.mjs` 按扩展名统计的结果 |
| `dist/build-info.json` | 98 字节 | 空索引时的基数 |
| `dist/plugins.json` | 3 字节 | 空数组 |
| `dist/tags.json` | 46 字节 | 4 条预设标签 |
| `dist/meta.json` | 61 字节 | 两个开关字段 |

本索引当前没有收录任何插件,所以体积只能给出基数。插件的增长路径是确定的: 每收录一个版本,`versions.json` 加一条、`build-info.json` 的 `versions` 数组加一项、`web_files.json` 加两行(`meta.json` 与 `plugin.js`)、逐文件签名加两份;每收录一个插件,`plugins.json` 加一条、`build-info.json` 加一个对象、`plugin_manifest.json` 加一项。

## 七、未对齐之处

以下五项是盘点中发现的口径不一致,本文只记录,不改代码与产物。

| 项 | 现状 | 影响 |
|:---:|:---:|:---:|
| `plugins/` 下的 Markdown 进 `dist/` 却不签名 | 构建整树复制,签名只覆盖四类扩展名 | 发布出去的是未签名说明文本;`verify-site` 不把它算作签名目标,也不会因此失败 |
| `tags.json` 不是必需文件 | 自洽性校验的根必需文件只有 `meta.json` 与 `plugins.json`([collection-verify.mjs:37](../../scripts/lib/collection-verify.mjs));构建缺文件时静默跳过([build-collection.mjs:126](../../scripts/build-collection.mjs)) | 词表缺失时构建仍通过,且标签校验整体失效: 词表为空集,未声明标签的检查被整段跳过([collection-verify.mjs:211](../../scripts/lib/collection-verify.mjs)) |
| `build-info.json` 被称为「分发索引」 | [README.md:202](../../README.md) 的措辞 | 容易被读成宿主读取的索引;它实际没有任何读取者 |
| `build-info.json` 无 schema 版本 | 只有四个顶层字段,无版本号 | 若将来给宿主读,接口已无版本位可扩展 |
| `eec.pem` 不进清单 | 扩展名在覆盖面外 | 清单只记路径不记证书指纹;证书轮换后清单内容不变,无法从清单看出是哪张证书签的 |

## 八、相关文件

| 文件 | 与本篇的关系 |
|:---:|:---:|
| [收录与作者签名](collection-and-author-signing.md) | 信任模型、两层签名的分工与未定稿项 |
| [构建脚本](../../scripts/build-collection.mjs) | 生成 `dist/` 索引与 `build-info.json` |
| [整站签名](../../scripts/sign-site.mjs) | 生成逐文件签名、清单、清单签名与 `eec.pem` |
| [签名自检](../../scripts/verify-site.mjs) | 逐文件与清单的读取方 |
| [PKI 封装](../../scripts/pki.mjs) | 覆盖面、清单名、签名参数的定义位置 |
| [自洽性校验](../../scripts/lib/collection-verify.mjs) | 索引数据与作者签名的读取方 |
| [发布流程](../../.github/workflows/build-and-deploy.yml) | 构建、签名、自检、发布的实际顺序 |
