#!/usr/bin/env node
/**
 * 按来源清单收录插件。
 *
 * 对清单中的每一项:取得源码、安装依赖、构建、把 dist 产物写入合集目录,
 * 再更新该插件的版本列表、该作者的插件清单与根目录插件目录。
 * 单项失败只跳过该项并记录原因,不影响其他项,退出码保持 0。
 *
 * 与旧版 JSON 签名实现的差别:不再处理 plugin_sign.json 与 plugin_secret.pub,
 * 改为复制作者侧分离签名与作者公钥。按组织约定,作者签名只覆盖 plugin.js,
 * 产物与合集内同一个文件名 plugin.js.author.sig;多位签名者依次为
 * plugin.js.author.sig.<序号>,与 author_pub.<序号>.pem 一一对应。
 * meta.json 的作者签名已取消,产物里遗留的 meta.json.author.sig 只提示、不复制。
 * 整站签名由 sign-site.mjs 在 dist/ 上生成,收录阶段不做签名。
 *
 * 产物侧另有一道静态扫描:dist/plugin.js 不得出现自行发起网络的写法,命中
 * PLUGIN_NETWORK_SELFTALK 只记警告,收录照常继续。它与 pnpm verify 侧的扫描
 * 共用同一个扫描器,口径一致:命中是提示,不是一票否决。
 *
 * 用法:
 *   node scripts/import-plugins.mjs
 *   node scripts/import-plugins.mjs --manifest .github/plugins-sources.json
 *   node scripts/import-plugins.mjs --manifest ./sources.json --keep-temp
 */
import { spawn } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AUTHOR_SIG_SUFFIX,
  VERSION_AUTHOR_SIGNED_FILES,
  authorPublicKeyFileName,
  authorSignerIndexFromKeyName,
  authorSignerIndexFromSignatureName,
} from './pki.mjs'
import { NETWORK_SELFTALK_CODE, describeNetworkHit, scanNetworkSelfTalk } from './lib/plugin-network-scan.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(SCRIPT_DIR, '..')
const TEMP_DIR = join(ROOT_DIR, 'temp', 'import')
const DEFAULT_MANIFEST = '.github/plugins-sources.json'

const BUILD_TIMEOUT_MS = Number(process.env.IMPORT_BUILD_TIMEOUT_MS || 900000)
const IS_WINDOWS = process.platform === 'win32'
const COPY_SKIP = new Set(['node_modules', '.git', 'dist', 'temp'])

// 作者目录名允许大小写字母、数字与连字符,不得以连字符开头;判定是否同一作者名时大小写不敏感,见 caseConflictingAuthor
const AUTHOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]*$/
const PLUGIN_PATTERN = /^(?:dsc-[a-z0-9][a-z0-9._-]*|@[a-z0-9][a-z0-9._-]*\/dsc-[a-z0-9][a-z0-9._-]*)$/
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const URL_PATTERN = /^https?:\/\/\S+$/i
const GIT_PATTERN = /^(?:https:\/\/|git@|git:\/\/|ssh:\/\/)/i

/**
 * 作者签名覆盖的文件,与组织约定一致:只认 plugin.js 的作者签名 plugin.js.author.sig。
 * 产物与合集内的文件名一致,收录只做复制,不改名。
 */
const AUTHOR_SIGNED_FILES = VERSION_AUTHOR_SIGNED_FILES
/** 已取消的作者签名文件:旧产物里可能还有,一律忽略 */
const RETIRED_AUTHOR_SIGNATURE = 'meta.json' + AUTHOR_SIG_SUFFIX

function usage() {
  process.stdout.write([
    '用法: node scripts/import-plugins.mjs [选项]',
    '',
    '选项:',
    '  --manifest <路径>   来源清单,默认 ' + DEFAULT_MANIFEST,
    '  --keep-temp         保留 temp/import 下的临时目录,便于排查',
    '  --help              显示本说明',
    '',
    '环境变量:',
    '  IMPORT_BUILD_TIMEOUT_MS   单项构建超时毫秒数,默认 900000',
    '  AUTHOR_SIGN_ENABLE        设为 true 时由插件构建产出作者签名',
    '  AUTHOR_SIGN_PRIVATE_KEY   作者私钥,只透传给插件构建,本脚本不读取内容',
    '',
  ].join('\n'))
}

function parseArgs(argv) {
  const options = { manifest: DEFAULT_MANIFEST, keepTemp: false, help: false }
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
      case '--manifest': options.manifest = take(); break
      case '--keep-temp': options.keepTemp = true; break
      case '--help':
      case '-h': options.help = true; break
      default: throw new Error('未知参数 ' + arg)
    }
  }
  return options
}

function log(message) {
  process.stdout.write(message + '\n')
}

function logWarning(message) {
  process.stderr.write('[警告] ' + message + '\n')
}

function logError(message) {
  process.stderr.write('[错误] ' + message + '\n')
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readJson(path, label) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    throw new Error('无法读取' + label + ' ' + path + ': ' + error.message)
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(label + ' ' + path + ' 不是合法 JSON: ' + error.message)
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

function compareVersions(left, right) {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

function quoteArg(value) {
  return /[\s"]/.test(value) ? '"' + value.replace(/"/g, '\\"') + '"' : value
}

function run(command, args, cwd, extraEnv = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const options = {
      cwd,
      env: { ...process.env, CI: '1', GIT_TERMINAL_PROMPT: '0', ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
    // Windows 上 pnpm 与 git 需要经 shell 调用,整条命令自行拼接并转义。
    const child = IS_WINDOWS
      ? spawn([command, ...args].map(quoteArg).join(' '), { ...options, shell: true })
      : spawn(command, args, options)

    let output = ''
    const collect = (chunk) => {
      output += chunk.toString('utf8')
      if (output.length > 20000) output = output.slice(-20000)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
    }, BUILD_TIMEOUT_MS)

    child.on('error', (error) => {
      clearTimeout(timer)
      rejectPromise(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolvePromise(output)
        return
      }
      rejectPromise(new Error(command + ' ' + args.join(' ') + ' 退出码 ' + code + '\n' + output.trim()))
    })
  })
}

function resolveSource(repo) {
  const raw = repo.trim()
  const localPath = isAbsolute(raw) ? raw : resolve(ROOT_DIR, raw)
  if (existsSync(localPath) && statSync(localPath).isDirectory()) return { kind: 'local', path: localPath }
  if (GIT_PATTERN.test(raw)) return { kind: 'git', url: raw }
  throw new Error('repo 既不是已存在的本地目录,也不是 git 地址: ' + raw)
}

async function prepareSource(item, workDir) {
  rmSync(workDir, { recursive: true, force: true })
  const source = resolveSource(item.repo)
  if (source.kind === 'local') {
    cpSync(source.path, workDir, {
      recursive: true,
      filter: (src) => !COPY_SKIP.has(basename(src)),
    })
    return '已复制本地目录 ' + source.path
  }
  const args = ['clone', '--depth', '1', '--quiet']
  if (item.ref) args.push('--branch', String(item.ref))
  args.push(source.url, workDir)
  await run('git', args, ROOT_DIR)
  return '已克隆 ' + source.url + (item.ref ? ' 的 ' + item.ref : '')
}

/**
 * 插件构建读取 AUTHOR_SIGN_ENABLE 与 AUTHOR_SIGN_PRIVATE_KEY 产出作者签名。
 * 插件仓库在「已开启但缺私钥」时会直接构建失败,那属于配置错误;
 * 收录这一侧宁可不签名继续跑,因此开启却缺私钥时如实降级为不签名并给出警告。
 */
function resolveAuthorSignEnv() {
  const enable = String(process.env.AUTHOR_SIGN_ENABLE || '').trim().toLowerCase() === 'true'
  if (!enable) return { env: {}, degraded: false }
  const key = String(process.env.AUTHOR_SIGN_PRIVATE_KEY || '').trim()
  if (key !== '') return { env: { AUTHOR_SIGN_ENABLE: 'true' }, degraded: false }
  return { env: { AUTHOR_SIGN_ENABLE: 'false' }, degraded: true }
}

const AUTHOR_SIGN = resolveAuthorSignEnv()

async function buildSource(workDir) {
  await run('pnpm', ['install', '--frozen-lockfile'], workDir, AUTHOR_SIGN.env)
  await run('pnpm', ['build'], workDir, AUTHOR_SIGN.env)
}

function readDist(distDir) {
  const metaPath = join(distDir, 'meta.json')
  if (!existsSync(metaPath)) throw new Error('构建产物缺少 dist/meta.json')
  const meta = readJson(metaPath, 'dist/meta.json')
  if (!isObject(meta)) throw new Error('dist/meta.json 的顶层必须是对象')
  if (typeof meta.name !== 'string' || !PLUGIN_PATTERN.test(meta.name)) {
    throw new Error('dist/meta.json 的 name 不是合法插件名: ' + JSON.stringify(meta.name))
  }
  if (typeof meta.version !== 'string' || !VERSION_PATTERN.test(meta.version)) {
    throw new Error('dist/meta.json 的 version 不是 x.y.z: ' + JSON.stringify(meta.version))
  }
  const jsPath = join(distDir, 'plugin.js')
  if (!existsSync(jsPath)) throw new Error('构建产物缺少 dist/plugin.js')
  warnNetworkSelfTalk(jsPath)
  return { meta, metaPath, jsPath, distDir }
}

/**
 * 收录侧扫描:插件脚本不得自建网络通道。
 *
 * 命中只记警告,收录照常进行:与 pnpm verify 侧共用同一个扫描器与错误码,
 * 两侧结论不会互相矛盾,也都不会因为命中而阻断。
 */
function warnNetworkSelfTalk(jsPath) {
  let source
  try {
    source = readFileSync(jsPath, 'utf8')
  } catch (error) {
    throw new Error('无法读取 dist/plugin.js: ' + error.message)
  }
  const result = scanNetworkSelfTalk(source, { maxHits: 5 })
  if (result.ok) return
  const detail = result.hits.map((hit) => describeNetworkHit(hit)).join('、')
  const more = result.truncated ? ' 等 ' + result.hitCount + ' 处' : ''
  logWarning(
    NETWORK_SELFTALK_CODE + ' dist/plugin.js 出现自行发起网络通道的写法: ' + detail + more
      + ';插件产物不得自建网络通道,仅警告,收录继续进行',
  )
}

function planVersions(pluginDir, version) {
  const path = join(pluginDir, 'versions.json')
  const current = existsSync(path) ? readJson(path, 'versions.json') : { latest: version, versions: [] }
  if (!isObject(current)) throw new Error('versions.json 的顶层必须是对象: ' + path)
  const list = Array.isArray(current.versions) ? current.versions.filter((item) => typeof item === 'string') : []
  if (!list.includes(version)) list.push(version)
  list.sort(compareVersions).reverse()
  return { path, value: { latest: list[0], versions: list } }
}

function planPluginManifest(author, plugin) {
  const path = join(ROOT_DIR, 'plugins', author, 'plugin_manifest.json')
  const current = existsSync(path) ? readJson(path, 'plugin_manifest.json') : []
  if (!Array.isArray(current)) throw new Error('plugins/' + author + '/plugin_manifest.json 的顶层必须是插件名数组')
  const names = current.filter((item) => typeof item === 'string')
  if (!names.includes(plugin)) names.push(plugin)
  names.sort()
  return { path, value: names }
}

function planPluginsIndex(plugin, author) {
  const path = join(ROOT_DIR, 'plugins.json')
  const current = existsSync(path) ? readJson(path, 'plugins.json') : []
  if (!Array.isArray(current)) throw new Error('plugins.json 的顶层必须是数组')
  const next = []
  let replaced = false
  for (const entry of current) {
    if (!isObject(entry) || entry.plugin_name !== plugin) {
      next.push(entry)
      continue
    }
    replaced = true
    next.push({
      plugin_name: plugin,
      author,
      tag: Array.isArray(entry.tag) ? entry.tag.filter((tag) => typeof tag === 'string') : [],
    })
  }
  if (!replaced) next.push({ plugin_name: plugin, author, tag: [] })
  return { path, value: next }
}

/**
 * 作者名判定大小写不敏感: 两个作者目录仅大小写不同视为同一名称,按重复处理。
 * 收录时若与既有作者目录或已登记 username 仅大小写不同,返回既有写法,由调用方按重复拒绝,
 * 要求维护者沿用已登记的写法,避免同一作者出现两个只差大小写的目录。
 */
function caseConflictingAuthor(author) {
  const lower = author.toLowerCase()
  const pluginsDir = join(ROOT_DIR, 'plugins')
  for (const name of existsSync(pluginsDir) ? readdirSync(pluginsDir) : []) {
    if (name !== author && name.toLowerCase() === lower) return name
  }
  const manifestPath = join(pluginsDir, 'author_manifest.json')
  if (!existsSync(manifestPath)) return null
  const manifest = readJson(manifestPath, 'author_manifest.json')
  if (!Array.isArray(manifest)) return null
  for (const entry of manifest) {
    const username = isObject(entry) && typeof entry.username === 'string' ? entry.username : ''
    if (username !== author && username.toLowerCase() === lower) return username
  }
  return null
}

function planAuthorManifest(author, profile) {
  const path = join(ROOT_DIR, 'plugins', 'author_manifest.json')
  const current = existsSync(path) ? readJson(path, 'author_manifest.json') : []
  if (!Array.isArray(current)) throw new Error('plugins/author_manifest.json 的顶层必须是数组')
  const next = []
  let replaced = false
  for (const entry of current) {
    if (isObject(entry) && typeof entry.username === 'string' && entry.username.toLowerCase() === author.toLowerCase()) {
      replaced = true
      next.push({ username: author, profile })
      continue
    }
    next.push(entry)
  }
  if (!replaced) next.push({ username: author, profile })
  next.sort((left, right) => {
    const a = isObject(left) && typeof left.username === 'string' ? left.username : ''
    const b = isObject(right) && typeof right.username === 'string' ? right.username : ''
    return a < b ? -1 : a > b ? 1 : 0
  })
  return { path, value: next }
}

/**
 * 先写文件、失败时回滚。JSON 之间的引用关系一旦半途失败就会让合集不自洽,因此统一收口。
 */
function applyWrites(staged) {
  const applied = []
  try {
    for (const item of staged) {
      const previous = existsSync(item.path) ? readFileSync(item.path, 'utf8') : null
      writeJson(item.path, item.value)
      applied.push({ path: item.path, previous })
    }
  } catch (error) {
    for (const item of applied.reverse()) {
      if (item.previous === null) rmSync(item.path, { force: true })
      else writeFileSync(item.path, item.previous, 'utf8')
    }
    throw error
  }
}

function validateItem(item, label) {
  if (!isObject(item)) throw new Error(label + ' 必须是对象')
  const author = typeof item.author === 'string' ? item.author.trim() : ''
  const plugin = typeof item.plugin === 'string' ? item.plugin.trim() : ''
  if (!AUTHOR_PATTERN.test(author)) throw new Error(label + ' 的 author 不是合法作者名: ' + JSON.stringify(item.author))
  if (!PLUGIN_PATTERN.test(plugin)) throw new Error(label + ' 的 plugin 不是合法插件名: ' + JSON.stringify(item.plugin))
  if (typeof item.repo !== 'string' || item.repo.trim() === '') throw new Error(label + ' 缺少 repo')
  if (item.ref !== undefined && (typeof item.ref !== 'string' || item.ref.trim() === '')) {
    throw new Error(label + ' 的 ref 必须是非空字符串')
  }
  if (item.profile !== undefined && (typeof item.profile !== 'string' || !URL_PATTERN.test(item.profile.trim()))) {
    throw new Error(label + ' 的 profile 必须是 http 或 https 地址')
  }
  return { author, plugin, profile: typeof item.profile === 'string' ? item.profile.trim() : null }
}

/**
 * 列出 dist/ 内的作者签名与作者公钥并按序号配对。
 * 签名文件名形如 plugin.js.author.sig(序号 1)或 plugin.js.author.sig.<序号>,
 * 公钥文件名形如 author_pub.pem(序号 1)或 author_pub.<序号>.pem。
 */
function collectAuthorArtifacts(distDir) {
  const signatures = []
  const publicKeys = []
  const invalid = []
  for (const name of readdirSync(distDir).sort()) {
    const keyIndex = authorSignerIndexFromKeyName(name)
    if (keyIndex !== null) {
      publicKeys.push({ index: keyIndex, name })
      continue
    }
    for (const file of AUTHOR_SIGNED_FILES) {
      if (!name.startsWith(file + AUTHOR_SIG_SUFFIX)) continue
      const sigIndex = authorSignerIndexFromSignatureName(name, file)
      if (sigIndex === null) invalid.push({ name, file })
      else signatures.push({ index: sigIndex, name, file })
      break
    }
  }
  signatures.sort((left, right) => left.index - right.index)
  return { signatures, publicKeys, invalid }
}

async function importOne(item, label, options) {
  const { author, plugin, profile } = validateItem(item, label)
  const conflicting = caseConflictingAuthor(author)
  if (conflicting) {
    throw new Error('作者名 ' + JSON.stringify(author) + ' 与既有写法 ' + JSON.stringify(conflicting)
      + ' 仅大小写不同,判定为同一名称,按重复拒绝;请沿用已登记的写法')
  }
  const dirName = plugin.split('/').pop()
  const authorDir = join(ROOT_DIR, 'plugins', author)
  const pluginDir = join(authorDir, dirName)
  const workDir = join(TEMP_DIR, author + '-' + dirName)
  let versionDir = null

  try {
    log('  ' + (await prepareSource(item, workDir)))
    await buildSource(workDir)

    const { meta, metaPath, jsPath, distDir } = readDist(join(workDir, 'dist'))
    if (meta.name !== plugin) {
      throw new Error('dist/meta.json 的 name 为 ' + meta.name + ',与清单的 ' + plugin + ' 不一致')
    }
    const version = meta.version
    versionDir = join(pluginDir, version)
    mkdirSync(versionDir, { recursive: true })
    cpSync(metaPath, join(versionDir, 'meta.json'))
    cpSync(jsPath, join(versionDir, 'plugin.js'))

    // 作者分离签名与作者公钥:产物与合集同名,按签名者序号整组复制,不改名
    const artifacts = collectAuthorArtifacts(distDir)
    for (const wrongName of artifacts.invalid) {
      logWarning('dist/' + wrongName.name + ' 不符合作者签名命名约定,已忽略;多签序号从 2 起写作 '
        + wrongName.file + AUTHOR_SIG_SUFFIX + '.<序号>')
    }
    for (const signature of artifacts.signatures) {
      cpSync(join(distDir, signature.name), join(versionDir, signature.name))
    }
    const copiedKeys = []
    if (artifacts.publicKeys.length > 0) {
      mkdirSync(authorDir, { recursive: true })
      for (const publicKey of artifacts.publicKeys) {
        cpSync(join(distDir, publicKey.name), join(authorDir, publicKey.name))
        copiedKeys.push(publicKey.name)
      }
    }

    // meta.json 的作者签名已取消:旧产物里可能还带着,只提示,不进版本目录
    if (existsSync(join(distDir, RETIRED_AUTHOR_SIGNATURE))) {
      log('  已忽略 dist/' + RETIRED_AUTHOR_SIGNATURE + '(作者签名只覆盖 ' + AUTHOR_SIGNED_FILES.join('、') + ')')
    }

    for (const signature of artifacts.signatures) {
      const keyName = authorPublicKeyFileName(signature.index)
      if (existsSync(join(authorDir, keyName))) continue
      logWarning('plugins/' + author + '/' + keyName + ' 不存在,第 ' + signature.index + ' 个签名者的作者签名将无法校验')
    }
    if (artifacts.signatures.length === 0) {
      logWarning('构建产物未带作者签名(' + AUTHOR_SIGNED_FILES.join('、') + AUTHOR_SIG_SUFFIX + '),该版本只有整站签名;'
        + '插件构建需要在 AUTHOR_SIGN_ENABLE=true 且提供 AUTHOR_SIGN_PRIVATE_KEY 时才会产出作者签名')
    }

    const staged = [planVersions(pluginDir, version), planPluginManifest(author, plugin), planPluginsIndex(plugin, author)]
    // 未给出 profile 时不写作者清单,避免登记一条没有主页的条目;校验脚本会就此给出警告。
    if (profile) staged.push(planAuthorManifest(author, profile))

    applyWrites(staged)
    return { version, signers: artifacts.signatures.map((signature) => signature.index), copiedKeys }
  } catch (error) {
    if (versionDir) rmSync(versionDir, { recursive: true, force: true })
    throw error
  } finally {
    if (!options.keepTemp) rmSync(workDir, { recursive: true, force: true })
  }
}

async function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    logError('收录失败: ' + error.message)
    usage()
    return 2
  }
  if (options.help) {
    usage()
    return 0
  }

  const manifestPath = isAbsolute(options.manifest) ? options.manifest : resolve(ROOT_DIR, options.manifest)
  if (!existsSync(manifestPath)) {
    logError('收录失败: 来源清单不存在: ' + manifestPath)
    return 2
  }
  let sources
  try {
    sources = readJson(manifestPath, '来源清单')
  } catch (error) {
    logError('收录失败: ' + error.message)
    return 2
  }
  if (!Array.isArray(sources)) {
    logError('收录失败: 来源清单的顶层必须是数组')
    return 2
  }
  if (sources.length === 0) {
    log('来源清单为空,没有需要收录的插件')
    return 0
  }

  mkdirSync(TEMP_DIR, { recursive: true })
  if (AUTHOR_SIGN.degraded) {
    logWarning('AUTHOR_SIGN_ENABLE 已开启但 AUTHOR_SIGN_PRIVATE_KEY 为空,本次收录降级为不签名,产物只带整站签名')
  }
  let imported = 0
  let skipped = 0

  for (const [index, item] of sources.entries()) {
    const label = '第 ' + (index + 1) + ' 项'
    const name = isObject(item) && typeof item.plugin === 'string' ? item.plugin : '(缺少 plugin 字段)'
    log('[' + label + '] ' + name)
    try {
      const result = await importOne(item, label, options)
      const signatureNote = result.signers.length > 0 ? ',作者签名 ' + result.signers.length + ' 个签名者' : ''
      const pubNote = result.copiedKeys.length > 0 ? ',已更新作者公钥 ' + result.copiedKeys.join('、') : ''
      log('  已收录 ' + name + '@' + result.version + signatureNote + pubNote)
      imported += 1
    } catch (error) {
      logError('  跳过 ' + name + ': ' + (error && error.message ? error.message : String(error)))
      skipped += 1
    }
  }

  // --keep-temp 时保留 temp/import/,便于排查单项构建产物
  if (!options.keepTemp) rmSync(TEMP_DIR, { recursive: true, force: true })
  log('收录汇总: 成功 ' + imported + ' 个,跳过 ' + skipped + ' 个')
  return 0
}

try {
  process.exitCode = await main()
} catch (error) {
  logError('收录失败: ' + (error && error.message ? error.message : String(error)))
  process.exitCode = 1
}
