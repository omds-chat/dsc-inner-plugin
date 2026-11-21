#!/usr/bin/env node
/**
 * 校验合集并生成分发内容。
 *
 * 流程: 先做合集自洽性校验(索引数据、作者公钥、作者签名与 plugin.js 的产物静态扫描),
 * 校验不通过则以非零退出码结束并列出全部问题;
 * 校验通过后把根目录元数据与 plugins/ 目录复制到输出目录,并写入 build-info.json 作为分发索引。
 *
 * 本脚本不再给插件文件签 CMS: 插件文件的作者签名随产物收录,整站签名由 sign-site.mjs 在 dist/ 上生成。
 * 根证书不进 dist,由 dsce 仓库的 certs 分支分发(本仓库没有该分支)。
 *
 * 用法:
 *   node scripts/build-collection.mjs --dir . --out dist
 *   node scripts/build-collection.mjs --dir template --collection-name demo --out dist
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { formatProblems, verifyCollection } from './lib/collection-verify.mjs'
import { requireOpenssl } from './pki.mjs'

/** 根目录内随 dist 分发的文件 */
const ROOT_DIST_FILES = ['meta.json', 'plugins.json', 'tags.json']

function usage() {
  process.stdout.write([
    '用法: node scripts/build-collection.mjs [选项]',
    '',
    '选项:',
    '  --dir <目录>                合集根目录,默认当前目录',
    '  --out <目录>                分发内容输出目录,默认 dist',
    '  --collection-name <名称>    合集名称,默认取合集目录名',
    '  --help                      显示本说明',
    '',
    '整站签名不在这里做,构建完成后运行:',
    '  DSC_INNER_PLUGIN_EEC_SECRET=... node scripts/sign-site.mjs --dir dist --eec <网页 EEC 证书>',
    '',
  ].join('\n'))
}

function parseArgs(argv) {
  const options = { dir: '.', out: 'dist', collectionName: null, help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const separator = arg.indexOf('=')
    const flag = separator === -1 ? arg : arg.slice(0, separator)
    const inline = separator === -1 ? null : arg.slice(separator + 1)
    const take = () => {
      if (inline !== null) return inline
      index += 1
      const value = argv[index]
      if (value === undefined) throw new Error(flag + ' 缺少取值')
      return value
    }
    switch (flag) {
      case '--dir': options.dir = take(); break
      case '--out': options.out = take(); break
      case '--collection-name': options.collectionName = take(); break
      case '--help':
      case '-h': options.help = true; break
      default: throw new Error('未知参数 ' + arg)
    }
  }
  return options
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function copyTree(srcDir, destDir) {
  if (!existsSync(srcDir)) return 0
  mkdirSync(destDir, { recursive: true })
  let count = 0
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const src = join(srcDir, entry.name)
    const dest = join(destDir, entry.name)
    if (entry.isDirectory()) {
      count += copyTree(src, dest)
    } else if (entry.isFile()) {
      copyFileSync(src, dest)
      count += 1
    }
  }
  return count
}

function collectIndex(root) {
  const pluginsIndexPath = join(root, 'plugins.json')
  if (!existsSync(pluginsIndexPath)) return []
  let pluginsIndex
  try {
    pluginsIndex = readJson(pluginsIndexPath)
  } catch {
    return []
  }
  if (!Array.isArray(pluginsIndex)) return []
  const index = []
  for (const entry of pluginsIndex) {
    if (typeof entry !== 'object' || entry === null) continue
    if (typeof entry.plugin_name !== 'string' || typeof entry.author !== 'string') continue
    const dirName = entry.plugin_name.split('/').pop()
    const versionsPath = join(root, 'plugins', entry.author, dirName, 'versions.json')
    let latest = null
    let versions = []
    if (existsSync(versionsPath)) {
      try {
        const data = readJson(versionsPath)
        latest = typeof data.latest === 'string' ? data.latest : null
        versions = Array.isArray(data.versions) ? data.versions : []
      } catch {
        latest = null
        versions = []
      }
    }
    index.push({ name: entry.plugin_name, author: entry.author, latest, versions })
  }
  return index
}

function writeDist(root, outDir, collectionName) {
  if (resolve(outDir) === resolve(root)) throw new Error('输出目录不能与合集根目录相同')
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  let files = 0
  for (const name of ROOT_DIST_FILES) {
    const src = join(root, name)
    if (!existsSync(src)) continue
    copyFileSync(src, join(outDir, name))
    files += 1
  }
  files += copyTree(join(root, 'plugins'), join(outDir, 'plugins'))
  const index = collectIndex(root)
  const info = {
    collection: collectionName,
    plugin_count: index.length,
    author_count: new Set(index.map((item) => item.author)).size,
    plugins: index,
  }
  writeFileSync(join(outDir, 'build-info.json'), JSON.stringify(info, null, 2) + '\n', 'utf8')
  files += 1
  return { files, info }
}

function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    process.stderr.write('构建失败:' + error.message + '\n\n')
    usage()
    return 2
  }
  if (options.help) {
    usage()
    return 0
  }

  try {
    requireOpenssl()
  } catch (error) {
    process.stderr.write('构建失败:' + error.message + '\n')
    return 2
  }

  const root = resolve(options.dir)
  const outDir = resolve(options.out)
  const result = verifyCollection(root, { collectionName: options.collectionName })
  const errors = result.problems.filter((item) => item.level === 'error')
  const warnings = result.problems.filter((item) => item.level === 'warning')

  if (errors.length > 0) {
    process.stderr.write('合集校验未通过,共 ' + errors.length + ' 个错误:' + '\n')
    process.stderr.write(formatProblems(result.problems) + '\n')
    return 1
  }

  const dist = writeDist(root, outDir, result.collectionName)
  const signerNote = result.stats.authorSignatures > 0 ? ',作者签名 ' + result.stats.authorSignatures + ' 个签名者' : ''
  process.stdout.write(
    '合集 ' + result.collectionName + ' 校验通过:' +
    result.stats.authors + ' 个作者,' +
    result.stats.plugins + ' 个插件,' +
    result.stats.versions + ' 个版本' + signerNote +
    ',产物静态扫描 ' + result.stats.scannedScripts + ' 个 plugin.js(命中 ' + result.stats.networkHits + ' 处,仅警告)' + '\n',
  )
  if (warnings.length > 0) {
    process.stdout.write('警告 ' + warnings.length + ' 条:' + '\n')
    process.stdout.write(formatProblems(warnings) + '\n')
  }
  process.stdout.write('分发内容已写入 ' + outDir + ',共 ' + dist.files + ' 个文件' + '\n')
  process.stdout.write('下一步: DSC_INNER_PLUGIN_EEC_SECRET=... node scripts/sign-site.mjs --dir ' + options.out + ' --eec <网页 EEC 证书>' + '\n')
  return 0
}

try {
  process.exitCode = main()
} catch (error) {
  process.stderr.write('构建失败:' + (error && error.message ? error.message : String(error)) + '\n')
  process.exitCode = 1
}
