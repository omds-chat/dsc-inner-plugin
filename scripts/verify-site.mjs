#!/usr/bin/env node
/**
 * 校验整站签名,对应 sign-site.mjs。
 *
 * 校验项:
 * - web_files.json 的签名;
 * - 清单列出的每个文件都存在且签名通过;
 * - 目录内每个 .html/.js/.css/.json 文件都出现在清单里;
 * - 不存在孤儿站点签名。
 *
 * 给出 --root-ca 时把网页 EEC 证书收进根证书形成的信任锚,做完整证书链校验;
 * 未给出时只做签名完整性校验(-noverify),适合本地快速自检。
 * 任一失败以非零状态退出。
 *
 * 用法:
 *   node scripts/verify-site.mjs --dir dist --root-ca root_ca.crt
 *   node scripts/verify-site.mjs --dir dist
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import {
  EEC_CERT_FILE,
  SITE_SIGNED_EXTENSIONS,
  WEB_MANIFEST_FILE,
  cmsSignaturePath,
  verifyChain,
  verifyFileCms,
  verifyFileCmsNoChain,
} from './pki.mjs'

function usage() {
  process.stdout.write([
    '用法: node scripts/verify-site.mjs [选项]',
    '',
    '选项:',
    '  --dir <目录>       待校验目录,默认 dist',
    '  --root-ca <证书>   根证书,给出时做证书链校验',
    '  --eec <证书>       网页 EEC 证书,默认 <目录>/' + EEC_CERT_FILE,
    '  --json             以 JSON 输出结果',
    '  --help             显示本说明',
    '',
  ].join('\n'))
}

function parseArgs(argv) {
  const options = { dir: 'dist', rootCa: null, eec: null, json: false, help: false }
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
      case '--root-ca': options.rootCa = take(); break
      case '--eec': options.eec = take(); break
      case '--json': options.json = true; break
      case '--help':
      case '-h': options.help = true; break
      default: throw new Error('未知参数 ' + arg)
    }
  }
  return options
}

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

function readManifestFiles(manifestPath) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.files)) return null
  return parsed.files.filter((item) => typeof item === 'string')
}

function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    process.stderr.write('校验失败:' + error.message + '\n\n')
    usage()
    return 2
  }
  if (options.help) {
    usage()
    return 0
  }

  const dir = resolve(options.dir)
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    process.stderr.write('校验失败:目录不存在或不是目录:' + dir + '\n')
    return 2
  }
  const rootCaPath = options.rootCa ? resolve(options.rootCa) : null
  const eecPath = resolve(options.eec || join(dir, EEC_CERT_FILE))
  const failures = []

  if (!existsSync(eecPath)) failures.push({ file: eecPath, reason: '网页 EEC 证书不存在' })
  if (rootCaPath !== null) {
    if (!existsSync(rootCaPath)) {
      failures.push({ file: rootCaPath, reason: '根证书不存在' })
    } else if (existsSync(eecPath)) {
      const chain = verifyChain(eecPath, rootCaPath)
      if (!chain.ok) failures.push({ file: eecPath, reason: '证书链校验失败:' + String(chain.reason) })
    }
  }

  const verifyOne = (filePath, sigPath) => (
    rootCaPath === null
      ? verifyFileCmsNoChain(filePath, sigPath, eecPath)
      : verifyFileCms(filePath, sigPath, rootCaPath, eecPath)
  )

  const manifestPath = join(dir, WEB_MANIFEST_FILE)
  const all = listFiles(dir).sort()
  const signedTargets = all.filter((rel) => rel !== WEB_MANIFEST_FILE && SITE_SIGNED_EXTENSIONS.includes(extname(rel).toLowerCase()))

  if (!existsSync(manifestPath)) {
    failures.push({ file: WEB_MANIFEST_FILE, reason: '整站签名清单不存在' })
  } else {
    const manifestResult = verifyOne(manifestPath, cmsSignaturePath(manifestPath))
    if (!manifestResult.ok) {
      failures.push({ file: WEB_MANIFEST_FILE, reason: '清单签名校验失败:' + String(manifestResult.reason) })
    }
    const listed = readManifestFiles(manifestPath)
    if (listed === null) {
      failures.push({ file: WEB_MANIFEST_FILE, reason: '清单结构不合法,要求 { schemaVersion, files }' })
    } else {
      for (const rel of listed) {
        const filePath = toAbsolute(dir, rel)
        if (!existsSync(filePath)) {
          failures.push({ file: rel, reason: '清单列出的文件不存在' })
          continue
        }
        const result = verifyOne(filePath, cmsSignaturePath(filePath))
        if (!result.ok) failures.push({ file: rel, reason: '签名校验失败:' + String(result.reason) })
      }
      const listedSet = new Set(listed)
      for (const rel of signedTargets) {
        if (!listedSet.has(rel)) failures.push({ file: rel, reason: '文件未出现在整站签名清单中' })
      }
    }
  }

  for (const rel of all) {
    if (!rel.endsWith('.sig') || rel.endsWith('.author.sig')) continue
    const target = rel.slice(0, -'.sig'.length)
    if (!existsSync(toAbsolute(dir, target))) failures.push({ file: rel, reason: '签名对应的文件不存在' })
  }

  if (options.json) {
    process.stdout.write(JSON.stringify({
      dir,
      rootCaPath,
      eecPath,
      signedFiles: signedTargets.length,
      chainChecked: rootCaPath !== null,
      failures,
    }, null, 2) + '\n')
  } else {
    process.stdout.write('[校验] 目录: ' + dir + '\n')
    process.stdout.write('[校验] 证书链: ' + (rootCaPath === null ? '未校验(缺少 --root-ca)' : '已用 ' + rootCaPath + ' 校验') + '\n')
    process.stdout.write('[校验] 已校验 ' + signedTargets.length + ' 个签名文件,失败 ' + failures.length + ' 项\n')
    if (failures.length > 0) {
      for (const item of failures) process.stdout.write('[校验]   ' + item.file + ' -> ' + item.reason + '\n')
    } else {
      process.stdout.write('[校验] 全部签名校验通过\n')
    }
  }
  return failures.length === 0 ? 0 : 1
}

try {
  process.exitCode = main()
} catch (error) {
  process.stderr.write('校验失败:' + (error && error.message ? error.message : String(error)) + '\n')
  process.exitCode = 1
}
