#!/usr/bin/env node
/**
 * 整站签名: 对 dist/ 内的代码与数据文件生成 CMS 分离签名。
 *
 * 本仓库的信任模型分两层:
 * - 整站签名: 用 dsc 的网页终端签名证书(EEC)给 dist/ 内每个 .html/.js/.css/.json 文件签名,
 *   产出 <文件>.sig、web_files.json 与 web_files.json.sig,并把证书复制为 dist/eec.pem;
 * - 作者签名: dsc 作为插件作者,用 Ed25519 裸公钥分离签名给 plugin.js 与 meta.json 签名,
 *   随插件产物收录为 *.author.sig,由 verify-collection.mjs 校验。
 *
 * 索引数据(datalog.json、versions.json、各 meta.json)决定市场显示什么,因此一并签名。
 * 签名是对文件原始字节的 CMS 分离签名,固定 -binary -outform DER,与 dsce 的 sign-web 同一套机制。
 *
 * 私钥只从环境变量 WEB_EEC_KEY 或 --key 读取,证书从 --eec 或环境变量 WEB_EEC_CERT 读取,
 * 两者都可以是 PEM 文本或文件路径。缺私钥或证书时不产出任何签名,只在日志里警告并返回 0,
 * 方便本地调试;CI 用 --require-key 把这种缺失当作错误。
 *
 * 用法:
 *   WEB_EEC_KEY=... node scripts/sign-site.mjs --dir dist --eec web-eec.pem
 *   node scripts/sign-site.mjs --dir dist --eec web-eec.pem --key web-eec-secret.pem
 *   WEB_EEC_KEY=... WEB_EEC_CERT=... node scripts/sign-site.mjs --dir dist --require-key
 */
import { copyFileSync, existsSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import {
  EEC_CERT_FILE,
  SITE_SIGNED_EXTENSIONS,
  WEB_MANIFEST_FILE,
  WEB_MANIFEST_SCHEMA,
  certMatchesKey,
  cmsSignaturePath,
  describeCertificate,
  hasDigitalSignature,
  requireOpenssl,
  resolveKeyFile,
  signFileCms,
} from './pki.mjs'

/** 站点签名的后缀,用于识别孤儿签名 */
const SITE_SIGNATURE_SUFFIX = '.sig'
/** 作者签名的后缀,站点签名不得覆盖或清理这类文件 */
const AUTHOR_SIGNATURE_SUFFIX = '.author.sig'

function usage() {
  process.stdout.write([
    '用法: node scripts/sign-site.mjs [选项]',
    '',
    '选项:',
    '  --dir <目录>       待签名目录,默认 dist',
    '  --eec <证书>       网页终端签名证书,可为 PEM 文本或文件路径',
    '  --key <私钥>       网页 EEC 私钥,可为 PEM 文本或文件路径',
    '  --require-key      缺少私钥或证书时以非零状态退出,CI 使用',
    '  --help             显示本说明',
    '',
    '环境变量:',
    '  WEB_EEC_KEY        网页 EEC 私钥,等价于 --key',
    '  WEB_EEC_CERT       网页 EEC 证书,等价于 --eec',
    '',
    '签名覆盖 ' + SITE_SIGNED_EXTENSIONS.join('/') + ' 文件,清单写 ' + WEB_MANIFEST_FILE + ',清单自身单独签名。',
    '',
  ].join('\n'))
}

function parseArgs(argv) {
  const options = { dir: 'dist', eec: null, key: null, requireKey: false, help: false }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--') continue
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
      case '--eec': options.eec = take(); break
      case '--key': options.key = take(); break
      case '--require-key': options.requireKey = true; break
      case '--help':
      case '-h': options.help = true; break
      default: throw new Error('未知参数 ' + arg)
    }
  }
  return options
}

/** 递归列出目录内的文件,返回以正斜杠分隔的相对路径 */
function listFiles(dir, prefix = '') {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix === '' ? entry.name : prefix + '/' + entry.name
    if (entry.isDirectory()) files.push(...listFiles(join(dir, entry.name), rel))
    else if (entry.isFile()) files.push(rel)
  }
  return files
}

function toAbsolute(dir, rel) {
  return join(dir, ...rel.split('/'))
}

/** 判断是否为需要整站签名的文件: 扩展名在名单内,且不是清单自身 */
function isSignedTarget(rel) {
  if (rel === WEB_MANIFEST_FILE) return false
  return SITE_SIGNED_EXTENSIONS.includes(extname(rel).toLowerCase())
}

function fail(message) {
  process.stderr.write('[错误] ' + message + '\n')
  return 1
}

function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    process.stderr.write('签名失败:' + error.message + '\n\n')
    usage()
    return 2
  }
  if (options.help) {
    usage()
    return 0
  }

  const dir = resolve(options.dir)
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return fail('待签名目录不存在或不是目录:' + dir)
  }

  const keySource = String(options.key || process.env.WEB_EEC_KEY || '').trim()
  const certSource = String(
    options.eec ||
    process.env.WEB_EEC_CERT ||
    (existsSync(join(dir, EEC_CERT_FILE)) ? join(dir, EEC_CERT_FILE) : ''),
  ).trim()

  const missing = []
  if (keySource === '') missing.push('私钥(WEB_EEC_KEY 或 --key)')
  if (certSource === '') missing.push('证书(WEB_EEC_CERT 或 --eec)')
  if (missing.length > 0) {
    const message = '缺少' + missing.join('与') + ',未对 ' + dir + ' 做整站签名'
    if (options.requireKey) return fail(message)
    process.stderr.write('[警告] ' + message + '\n')
    process.stderr.write('[警告] dist/ 保持未签名状态,只适合本地调试;正式发布必须提供网页 EEC 私钥与证书\n')
    return 0
  }

  try {
    requireOpenssl()
  } catch (error) {
    return fail(error.message)
  }

  let keyFile
  let certFile
  try {
    keyFile = resolveKeyFile(keySource, '网页 EEC 私钥')
    certFile = resolveKeyFile(certSource, '网页 EEC 证书')
  } catch (error) {
    if (keyFile) keyFile.cleanup()
    return fail(error.message)
  }

  try {
    if (!certMatchesKey(certFile.path, keyFile.path)) {
      return fail('网页 EEC 证书与私钥不配对:' + certFile.path + ' 与 ' + keyFile.path)
    }
    const info = describeCertificate(certFile.path)
    if (!info.validNow) {
      return fail('网页 EEC 证书已过期,notAfter=' + String(info.notAfter))
    }
    if (!hasDigitalSignature(info.keyUsage)) {
      return fail('网页 EEC 证书的 keyUsage 不含 digitalSignature,实际为 [' + info.keyUsage.join(', ') + ']')
    }
    if (info.isCa === true) {
      return fail('网页 EEC 证书是 CA 证书,要求 basicConstraints 为 CA:FALSE')
    }

    const all = listFiles(dir).sort()

    // 孤儿签名: 源文件已不在的站点签名直接清掉,避免上一轮产物残留
    let removed = 0
    for (const rel of all) {
      if (!rel.endsWith(SITE_SIGNATURE_SUFFIX) || rel.endsWith(AUTHOR_SIGNATURE_SUFFIX)) continue
      const target = rel.slice(0, -SITE_SIGNATURE_SUFFIX.length)
      if (rel === WEB_MANIFEST_FILE + SITE_SIGNATURE_SUFFIX) continue
      if (existsSync(toAbsolute(dir, target))) continue
      rmSync(toAbsolute(dir, rel), { force: true })
      removed += 1
    }

    const targets = all.filter(isSignedTarget)
    if (targets.length === 0) {
      return fail('目录下没有可签名的 ' + SITE_SIGNED_EXTENSIONS.join('/') + ' 文件:' + dir)
    }
    for (const rel of targets) {
      signFileCms(toAbsolute(dir, rel), certFile.path, keyFile.path)
    }

    // 清单只列被逐文件签名的产物,清单自身不在其中,它的签名单独生成
    const manifestPath = join(dir, WEB_MANIFEST_FILE)
    writeFileSync(manifestPath, JSON.stringify({ schemaVersion: WEB_MANIFEST_SCHEMA, files: targets }, null, 2) + '\n', 'utf8')
    signFileCms(manifestPath, certFile.path, keyFile.path)

    const targetEec = join(dir, EEC_CERT_FILE)
    if (resolve(targetEec) !== resolve(certFile.path)) copyFileSync(certFile.path, targetEec)

    process.stdout.write('[签名] 目录: ' + dir + '\n')
    process.stdout.write('[签名] 证书: ' + String(info.subject) + '\n')
    process.stdout.write('[签名]   sha256: ' + String(info.fingerprint) + '\n')
    process.stdout.write('[签名]   有效期: ' + String(info.notBefore) + ' -> ' + String(info.notAfter) + '\n')
    process.stdout.write('[签名] 已签名 ' + targets.length + ' 个文件,输出 <文件>.sig(CMS 分离签名, -binary -outform DER)\n')
    if (removed > 0) process.stdout.write('[签名] 已清理孤儿签名 ' + removed + ' 个\n')
    process.stdout.write('[签名] 已写出清单 ' + WEB_MANIFEST_FILE + ' 及其签名 ' + WEB_MANIFEST_FILE + SITE_SIGNATURE_SUFFIX + '\n')
    process.stdout.write('[签名] 已写出证书 ' + EEC_CERT_FILE + '\n')
    return 0
  } finally {
    keyFile.cleanup()
    certFile.cleanup()
  }
}

try {
  process.exitCode = main()
} catch (error) {
  process.stderr.write('签名失败:' + (error && error.message ? error.message : String(error)) + '\n')
  process.exitCode = 1
}
