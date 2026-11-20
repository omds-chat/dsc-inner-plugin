# dsc-humanize(待收录)

本目录是收录 dsc-humanize 的预留位置,当前只有本说明,没有任何产物。

## 这里不放什么

- 不放 `meta.json` 与 `plugin.js`:两者只能来自 dsc-humanize 源码仓库 `pnpm build` 的 `dist/`。
- 不放任何签名文件:作者签名来自插件产物,整站签名由 `scripts/sign-site.mjs` 在 `dist/` 上生成。
- 不放 `versions.json`:版本号只能取自产物 `dist/meta.json`,预先写死就等于编造版本。

## 正式收录时会发生什么

`scripts/import-plugins.mjs` 会把本目录补齐为:

```text
plugins/omds-chat/dsc-humanize/
  versions.json
  <x.y.z>/
    meta.json
    plugin.js
    meta.json.author.sig    可选,产物带 dist/meta.json.sig 时才有
    plugin.js.author.sig    可选,产物带 dist/plugin.js.sig 时才有
```

同时把产物里的 `dist/author_pub.pem` 复制为 `plugins/omds-chat/author_pub.pem`,并在根目录 `plugins.json` 追加条目。

## 为什么现在不写 plugins.json 条目

校验要求 `plugins.json` 的每个条目都有完整版本目录,`meta.json` 与 `plugin.js` 缺一即报错。产物未就位时先写条目会让 `pnpm verify` 与 `pnpm build` 直接失败。因此本目录只声明「将来放这里」,索引条目由收录脚本在产物就位后写入。

## 待对齐的契约差异

截至本骨架,插件仓库的构建产出 `dist/plugin.js.author.sig`(带 `.author` 后缀,且只签 `plugin.js`),而本仓库的收录脚本按 `dist/plugin.js.sig` 与 `dist/meta.json.sig` 查找作者签名。命名尚未统一:直接收录会得到「插件未带作者签名」,作者签名不会进入版本目录。

另外,本仓库的校验在作者公钥可用但缺少 `meta.json.author.sig` 时给出 `AUTHOR_SIGN_MISSING` 警告,只警告不阻断。

正式收录前需要二选一对齐:插件构建把产物改名为 `dist/<文件>.sig`,或收录脚本同时接受 `dist/<文件>.author.sig`。

正式收录完成后可以删除本文件。
