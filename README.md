# dsc 同源插件

[English](README.en-US.md)

omdsc-dev 组织自研 dsc 插件的索引与分发入口,与社区合集 [awesome-dsc-plugin](https://github.com/omdsc-dev/awesome-dsc-plugin) 是兄弟仓库。

## 定位

本仓库只做三件事:

- 维护同源插件索引 `index.json`,记录每个收录插件的标识、名称、版本、说明、作者、主页与分发地址。
- 为收录的插件提供静态站点,展示条目、安装方法与分发地址。
- 承诺收录的插件不采集、不外传用户凭证与数据。

与社区合集的分工: `awesome-dsc-plugin` 面向社区投稿,本仓库只收录 omdsc-dev 组织自研的插件。索引格式与它完全一致,dsce 的插件市场可以直接消费两者中的任意一个。

## 当前索引

组织主线 dsce 的内置插件(dsc-core、dsc-plugin-engine、dsc-market)随产品分发,不作为可安装插件出现在本索引中。组织尚未发布可安装的同源插件,因此 `plugins/` 目录只有说明文件,生成的索引为空:

```json
{
  "schemaVersion": 1,
  "plugins": []
}
```

站点在该索引下显示空态说明,不展示任何虚构条目。

## 索引格式

```json
{
  "schemaVersion": 1,
  "plugins": [
    {
      "id": "dsc-example",
      "name": "示例插件",
      "version": "0.1.0",
      "description": "一句话说明",
      "author": "omdsc-dev",
      "homepage": "https://github.com/omdsc-dev/dsc-inner-plugin",
      "download": "https://omdsc-dev.github.io/dsc-inner-plugin/plugins/dsc-example.js",
      "manifest": {}
    }
  ]
}
```

上面的片段只说明格式,不构成收录条目。

| 字段 | 类型 | 必填 | 说明 |
|:---:|:---:|:---:|:---:|
| `schemaVersion` | number | 是 | 固定为 1 |
| `plugins` | array | 是 | 条目数组,按 `id` 字典序排列 |
| `plugins[].id` | string | 是 | 插件标识,匹配 `^[a-z][a-z0-9-]{2,63}$` |
| `plugins[].name` | string | 是 | 展示名称,非空 |
| `plugins[].version` | string | 是 | 三段数字,形如 `0.1.0` |
| `plugins[].description` | string | 是 | 一句话说明,非空 |
| `plugins[].author` | string | 是 | 作者或组织名,非空 |
| `plugins[].homepage` | string | 是 | http 或 https 地址 |
| `plugins[].download` | string | 是 | https 分发地址,或本仓库相对路径 |
| `plugins[].manifest` | object | 否 | 插件清单,省略时由 dsce 使用产物导出的清单 |

## 目录结构

```text
dsc-inner-plugin/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── .gitignore
├── LICENSE
├── README.md
├── README.en-US.md
├── build.mjs
├── package.json
├── pnpm-workspace.yaml
├── plugins/
│   └── README.md
├── scripts/
│   └── build-index.mjs
├── tsconfig.json
└── src/
    ├── index.html
    ├── main.ts
    ├── styles.css
    └── i18n.ts
```

## 构建

```bash
pnpm install
pnpm run type
pnpm run build
```

`pnpm run build` 由两个脚本串联组成,执行顺序不可颠倒:

1. `node build.mjs`: 清空 `dist/`,用 esbuild 打包 `src/main.ts` 到 `dist/assets/main.js`,复制样式与页面,写入 `dist/.nojekyll`。
2. `node scripts/build-index.mjs`: 校验 `plugins/*.json`,写出 `dist/index.json` 与 `dist/plugins/*.json`。

站点构建必须在前,因为它会清空整个 `dist/`。索引生成只清理自己产出的 `dist/index.json` 与 `dist/plugins/*.json`,不会动站点产物,所以放在后面。

单独执行:

```bash
pnpm run build:site   # 只构建站点
pnpm run build:index  # 只生成索引
pnpm run type         # 类型检查
```

## 本地预览

```bash
pnpm run build
npx serve dist
```

打开输出的地址即可看到站点。站点读取同目录下的 `./index.json`,因此必须与索引文件一起预览。

## 收录条件

- 插件由 omdsc-dev 组织自研并维护。
- 插件不采集、不外传用户凭证与数据,不隐式发起网络请求。
- 产物符合 dsc 插件产物规范: 单个浏览器 ESM js 文件,导出 `activate(context)`,不引用 Node 内置模块与后端接口。
- 提供 https 分发地址,或提供可构建的仓库地址。
- 条目通过 `node scripts/build-index.mjs` 的全部校验。

细节见 [plugins/README.md](plugins/README.md)。

## 安装方法

1. 在 dsce 侧边栏打开插件面板。
2. 在面板底部的「从地址安装」输入框中粘贴插件的下载地址。
3. 点击「安装」,插件随即自动启用。

站点为每个条目给出同样的三步说明,并提供一键复制下载地址。

## 站点行为

- 读取本仓库自己的 `./index.json`,不访问任何外部地址。
- 空索引时显示空态说明,说明组织尚未发布可安装的同源插件。
- 中英双语切换,深浅色跟随系统设置。
- 提示统一使用页面内联文案,不调用浏览器原生弹窗。
- 窄屏单列显示,不引入前端框架与运行时依赖。

## 部署

`.github/workflows/deploy.yml` 在推送到 `main` 且改动落在 `plugins/`、`scripts/`、`src/`、`build.mjs` 时触发,也支持手动触发。工作流执行 `pnpm install --frozen-lockfile` 与 `pnpm build`,把 `dist/` 部署到 Pages。

权限只授予 `contents: read`、`pages: write`、`id-token: write`。

仓库需要一并提交 `pnpm-lock.yaml`,否则冻结安装会失败。

## 许可

Apache-2.0,见 [LICENSE](LICENSE)。
