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
    plugin.js.author.sig    可选,产物带 dist/plugin.js.author.sig 时才有
```

同时把产物里的 `dist/author_pub.pem` 复制为 `plugins/omds-chat/author_pub.pem`,并在根目录 `plugins.json` 追加条目。

## 为什么现在不写 plugins.json 条目

校验要求 `plugins.json` 的每个条目都有完整版本目录,`meta.json` 与 `plugin.js` 缺一即报错。产物未就位时先写条目会让 `pnpm verify` 与 `pnpm build` 直接失败。因此本目录只声明「将来放这里」,索引条目由收录脚本在产物就位后写入。

## 契约对齐情况

插件仓库的构建在 `AUTHOR_SIGN_ENABLE=true` 且提供 `AUTHOR_SIGN_PRIVATE_KEY` 时产出 `dist/plugin.js.author.sig` 与 `dist/author_pub.pem`,只签 `plugin.js`;本仓库的收录脚本按同样的文件名查找并原样复制,命名已经统一,不再有「产物签名进不来」的问题。

多位签名者依次为 `plugin.js.author.sig.<序号>` 与 `author_pub.<序号>.pem`,规则见 [插件目录说明](../../README.md)。产物缺作者签名时只警告,该版本仍受整站签名覆盖;作者签名校验失败同样只警告。

正式收录完成后可以删除本文件。
