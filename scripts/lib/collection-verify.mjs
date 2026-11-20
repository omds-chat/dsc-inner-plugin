/**
 * 合集自洽性校验(作者签名版)。
 *
 * 校验对象是本仓库的索引目录结构:根目录元数据、作者公钥、插件清单、版本目录与作者分离签名。
 * 只读取文件,不修改任何内容;build-collection.mjs 与 verify-collection.mjs 共用本模块。
 *
 * 本仓库不再持有「合集 EEC 签发插件」这一层:插件文件的信任由两层构成,
 * 一是 dsc 作为作者用 Ed25519 裸公钥给的 plugin.js.author.sig,由本脚本校验;
 * 二是 dsc 用网页 EEC 给 dist/ 整站产物做的 CMS 分离签名,由 sign-site.mjs 产出、
 * verify-site.mjs 校验。因此本脚本只校验索引与作者签名,不再要求任何证书链。
 *
 * 作者签名可以有多位签名者:第 1 位是 <文件>.author.sig 配 author_pub.pem,
 * 第 n 位是 <文件>.author.sig.<n> 配 author_pub.<n>.pem。逐个校验,结果与签名者列表
 * 一并写进报告,便于界面展示多个签名者。
 *
 * 配对规则:签名文件与作者公钥按序号一对一,两份缺一不可。只有签名文件没有对应公钥,
 * 判为该签名者无法校验;只有公钥没有签名文件,判为该版本作者签名缺失。两种情形都不算通过。
 *
 * 校验语义:索引结构与公钥材料属于发布前的强校验,出错以非零退出码结束;
 * 作者签名的校验结果一律只记警告(全组织口径:签名失败只警告,不阻断),
 * 与插件市场一侧的口径保持一致。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import {
  AUTHOR_PUB_FILE,
  AUTHOR_SIG_SUFFIX,
  VERSION_AUTHOR_SIGNED_FILES,
  authorPublicKeyFileName,
  authorSignerIndexFromKeyName,
  authorSignerIndexFromSignatureName,
  describePublicKey,
  verifyFileAuthor,
} from '../pki.mjs'

/** 合集根目录必需的文件 */
export const ROOT_REQUIRED_FILES = ['meta.json', 'plugins.json']
/** 版本目录内必需的文件,作者签名不在其中 */
export const VERSION_REQUIRED_FILES = ['meta.json', 'plugin.js']
/** 第 1 个签名者的作者公钥文件名 */
export const AUTHOR_PUB_RELATIVE = AUTHOR_PUB_FILE

export { VERSION_AUTHOR_SIGNED_FILES }

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const PLUGIN_NAME_PATTERN = /^(?:dsc-[a-z0-9][a-z0-9._-]*|@[a-z0-9][a-z0-9._-]*\/dsc-[a-z0-9][a-z0-9._-]*)$/

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function isFile(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function readText(path) {
  return readFileSync(path, 'utf8')
}

function parseJsonFile(path, label, report) {
  let text
  try {
    text = readText(path)
  } catch (error) {
    report.error('FILE_UNREADABLE', label + ' 无法读取:' + error.message, path)
    return undefined
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    report.error('JSON_INVALID', label + ' 不是合法 JSON:' + error.message, path)
    return undefined
  }
}

/**
 * 校验一个合集目录。
 * @param {string} collectionDir 合集根目录
 * @param {object} [options] 选项
 * @param {string} [options.collectionName] 合集名称,默认取目录名
 * @returns {{ok: boolean, root: string, collectionName: string, errorCount: number, warningCount: number, problems: Array<object>, stats: object, signatures: Array<object>}}
 */
export function verifyCollection(collectionDir, options = {}) {
  const root = resolve(collectionDir)
  const problems = []
  const stats = { authors: 0, plugins: 0, versions: 0, authorSignatures: 0 }
  /**
   * 每个版本文件的作者签名记录,保留全部签名者,便于后续界面展示多个签名者:
   * { plugin, version, file, ok, signers: [{ index, signature, publicKey, ok, reason }] }
   */
  const signatures = []
  const report = {
    error(code, message, path) {
      problems.push({ level: 'error', code, message, path: path ?? null })
    },
    warn(code, message, path) {
      problems.push({ level: 'warning', code, message, path: path ?? null })
    },
  }
  const collectionName = options.collectionName || basename(root)

  const finish = () => {
    const errorCount = problems.filter((item) => item.level === 'error').length
    return {
      ok: errorCount === 0,
      root,
      collectionName,
      errorCount,
      warningCount: problems.length - errorCount,
      problems,
      stats,
      signatures,
    }
  }

  if (!isDirectory(root)) {
    report.error('ROOT_MISSING', '合集目录不存在或不是目录:' + root, root)
    return finish()
  }

  // 一、根目录必需文件
  for (const name of ROOT_REQUIRED_FILES) {
    if (!isFile(join(root, name))) report.error('ROOT_FILE_MISSING', '根目录缺少必需文件 ' + name, name)
  }

  // 二、合集元数据
  const metaPath = join(root, 'meta.json')
  const collectionMeta = isFile(metaPath) ? parseJsonFile(metaPath, '根目录 meta.json', report) : undefined
  if (isObject(collectionMeta)) {
    if (typeof collectionMeta.DOWNLOAD_COUNT_ENABLE !== 'boolean') {
      report.error('META_FIELD_INVALID', 'meta.json 的 DOWNLOAD_COUNT_ENABLE 必须是布尔值', 'meta.json')
    } else if (collectionMeta.DOWNLOAD_COUNT_ENABLE === true) {
      if (typeof collectionMeta.DOWNLOAD_COUNT_API !== 'string' || collectionMeta.DOWNLOAD_COUNT_API.length === 0) {
        report.error('META_FIELD_INVALID', '启用下载计数时 meta.json 的 DOWNLOAD_COUNT_API 必须是非空字符串', 'meta.json')
      }
      if (typeof collectionMeta.API_NEED_IP !== 'boolean') {
        report.error('META_FIELD_INVALID', '启用下载计数时 meta.json 的 API_NEED_IP 必须是布尔值', 'meta.json')
      }
    }
  } else if (collectionMeta !== undefined) {
    report.error('META_FIELD_INVALID', '根目录 meta.json 的顶层必须是对象', 'meta.json')
  }

  // 三、预设标签
  const tagsPath = join(root, 'tags.json')
  let tagSet = null
  if (isFile(tagsPath)) {
    const tags = parseJsonFile(tagsPath, 'tags.json', report)
    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        report.error('TAGS_INVALID', 'tags.json 的顶层必须是字符串数组', 'tags.json')
      } else {
        const seen = new Set()
        for (const [index, tag] of tags.entries()) {
          if (typeof tag !== 'string' || tag.length === 0) {
            report.error('TAGS_INVALID', 'tags.json 第 ' + index + ' 项必须是非空字符串', 'tags.json')
            continue
          }
          if (seen.has(tag)) report.warn('TAGS_DUPLICATE', 'tags.json 存在重复标签 ' + tag, 'tags.json')
          seen.add(tag)
        }
        tagSet = seen
      }
    }
  }

  // 四、插件目录索引 plugins.json
  const pluginsIndexPath = join(root, 'plugins.json')
  const pluginsIndex = isFile(pluginsIndexPath) ? parseJsonFile(pluginsIndexPath, 'plugins.json', report) : undefined
  const entries = []
  if (pluginsIndex !== undefined) {
    if (!Array.isArray(pluginsIndex)) {
      report.error('PLUGINS_INDEX_INVALID', 'plugins.json 的顶层必须是数组', 'plugins.json')
    } else {
      const seenNames = new Set()
      for (const [index, entry] of pluginsIndex.entries()) {
        const label = 'plugins.json 第 ' + index + ' 项'
        if (!isObject(entry)) {
          report.error('PLUGINS_INDEX_INVALID', label + ' 必须是对象', 'plugins.json')
          continue
        }
        if (typeof entry.plugin_name !== 'string' || !PLUGIN_NAME_PATTERN.test(entry.plugin_name)) {
          report.error('PLUGINS_INDEX_INVALID', label + ' 的 plugin_name 不是合法的插件名', 'plugins.json')
          continue
        }
        if (typeof entry.author !== 'string' || entry.author.length === 0) {
          report.error('PLUGINS_INDEX_INVALID', label + ' 的 author 必须是非空字符串', 'plugins.json')
          continue
        }
        if (!Array.isArray(entry.tag) || entry.tag.some((tag) => typeof tag !== 'string' || tag.length === 0)) {
          report.error('PLUGINS_INDEX_INVALID', label + ' 的 tag 必须是字符串数组', 'plugins.json')
          continue
        }
        if (seenNames.has(entry.plugin_name)) {
          report.error('PLUGINS_INDEX_DUPLICATE', '插件名 ' + entry.plugin_name + ' 在 plugins.json 中重复出现', 'plugins.json')
          continue
        }
        seenNames.add(entry.plugin_name)
        if (tagSet) {
          for (const tag of entry.tag) {
            if (!tagSet.has(tag)) {
              report.error('TAG_NOT_DECLARED', '插件 ' + entry.plugin_name + ' 的标签 ' + tag + ' 未在 tags.json 中声明', 'plugins.json')
            }
          }
        }
        entries.push({ plugin_name: entry.plugin_name, author: entry.author, tag: [...entry.tag] })
      }
    }
  }

  // 五、作者清单
  const authorManifestPath = join(root, 'plugins', 'author_manifest.json')
  const registeredAuthors = new Set()
  if (!isFile(authorManifestPath)) {
    report.error('AUTHOR_MANIFEST_MISSING', 'plugins/author_manifest.json 不存在', 'plugins/author_manifest.json')
  } else {
    const manifest = parseJsonFile(authorManifestPath, 'plugins/author_manifest.json', report)
    if (manifest !== undefined) {
      if (!Array.isArray(manifest)) {
        report.error('AUTHOR_MANIFEST_INVALID', 'plugins/author_manifest.json 的顶层必须是数组', 'plugins/author_manifest.json')
      } else {
        for (const [index, item] of manifest.entries()) {
          const label = 'plugins/author_manifest.json 第 ' + index + ' 项'
          if (!isObject(item) || typeof item.username !== 'string' || item.username.length === 0) {
            report.error('AUTHOR_MANIFEST_INVALID', label + ' 缺少合法的 username', 'plugins/author_manifest.json')
            continue
          }
          if (typeof item.profile !== 'string' || item.profile.length === 0) {
            report.error('AUTHOR_MANIFEST_INVALID', label + ' 缺少合法的 profile', 'plugins/author_manifest.json')
          }
          if (registeredAuthors.has(item.username)) {
            report.warn('AUTHOR_MANIFEST_DUPLICATE', '作者 ' + item.username + ' 在 author_manifest.json 中重复登记', 'plugins/author_manifest.json')
          }
          registeredAuthors.add(item.username)
        }
      }
    }
  }

  // 六、逐插件校验
  const authorCache = new Map()
  for (const entry of entries) {
    const author = entry.author
    if (!registeredAuthors.has(author)) {
      report.warn('AUTHOR_NOT_REGISTERED', '作者 ' + author + ' 未在 plugins/author_manifest.json 中登记', 'plugins/author_manifest.json')
    }
    if (!authorCache.has(author)) {
      authorCache.set(author, inspectAuthor({ root, author, report }))
    }
    const authorContext = authorCache.get(author)
    if (!authorContext) continue
    if (!authorContext.manifestPlugins.has(entry.plugin_name)) {
      report.error(
        'PLUGIN_NOT_IN_MANIFEST',
        '插件 ' + entry.plugin_name + ' 未出现在 plugins/' + author + '/plugin_manifest.json 中',
        'plugins/' + author + '/plugin_manifest.json',
      )
    }
    inspectPlugin({ authorContext, entry, report, stats, signatures })
  }

  for (const context of authorCache.values()) stats.authors += 1
  return finish()
}

function inspectAuthor({ root, author, report }) {
  const authorRel = 'plugins/' + author
  const authorDir = join(root, 'plugins', author)
  if (!isDirectory(authorDir)) {
    report.error('AUTHOR_DIR_MISSING', '作者目录不存在:' + authorRel, authorRel)
    return null
  }
  // 作者公钥按签名者序号配对:序号 1 是 author_pub.pem,序号 n>=2 是 author_pub.<n>.pem
  const keys = new Map()
  for (const name of readdirSync(authorDir).sort()) {
    const index = authorSignerIndexFromKeyName(name)
    if (index === null) continue
    const rel = authorRel + '/' + name
    const path = join(authorDir, name)
    let usable = false
    try {
      const info = describePublicKey(path)
      usable = true
      if (info.type !== 'ed25519') {
        report.warn('AUTHOR_PUB_TYPE', rel + ' 不是 Ed25519 公钥,约定作者密钥为 Ed25519,实际为 ' + info.firstLine, rel)
      }
    } catch (error) {
      report.error('AUTHOR_PUB_INVALID', rel + ' 不是合法的 PEM 公钥:' + error.message, rel)
    }
    keys.set(index, { index, path, rel, usable })
  }
  if (!keys.has(1)) {
    report.warn('AUTHOR_PUB_MISSING', '作者公钥不存在:' + authorRel + '/' + AUTHOR_PUB_FILE + ',该作者的插件不能带作者签名', authorRel + '/' + AUTHOR_PUB_FILE)
  }
  const manifestRel = authorRel + '/plugin_manifest.json'
  const manifestPath = join(authorDir, 'plugin_manifest.json')
  const manifestPlugins = new Set()
  if (!isFile(manifestPath)) {
    report.error('PLUGIN_MANIFEST_MISSING', '作者插件清单不存在:' + manifestRel, manifestRel)
  } else {
    const manifest = parseJsonFile(manifestPath, manifestRel, report)
    if (manifest !== undefined) {
      if (!Array.isArray(manifest)) {
        report.error('PLUGIN_MANIFEST_INVALID', manifestRel + ' 的顶层必须是插件名数组', manifestRel)
      } else {
        for (const [index, name] of manifest.entries()) {
          if (typeof name !== 'string' || !PLUGIN_NAME_PATTERN.test(name)) {
            report.error('PLUGIN_MANIFEST_INVALID', manifestRel + ' 第 ' + index + ' 项不是合法的插件名', manifestRel)
            continue
          }
          manifestPlugins.add(name)
        }
      }
    }
  }
  const hasUsableKey = [...keys.values()].some((item) => item.usable)
  return { author, authorDir, authorRel, keys, hasUsableKey, manifestPlugins }
}

function inspectPlugin({ authorContext, entry, report, stats, signatures }) {
  const { authorDir, authorRel } = authorContext
  const dirName = entry.plugin_name.split('/').pop()
  const pluginRel = authorRel + '/' + dirName
  const pluginDir = join(authorDir, dirName)
  if (!isDirectory(pluginDir)) {
    report.error('PLUGIN_DIR_MISSING', '插件目录不存在:' + pluginRel, pluginRel)
    return
  }
  stats.plugins += 1

  const versionsRel = pluginRel + '/versions.json'
  const versionsPath = join(pluginDir, 'versions.json')
  if (!isFile(versionsPath)) {
    report.error('VERSIONS_MISSING', '插件目录缺少 versions.json:' + versionsRel, versionsRel)
    return
  }
  const versionsData = parseJsonFile(versionsPath, versionsRel, report)
  if (versionsData === undefined) return
  if (!isObject(versionsData)) {
    report.error('VERSIONS_INVALID', versionsRel + ' 的顶层必须是对象', versionsRel)
    return
  }
  const versionList = Array.isArray(versionsData.versions) ? versionsData.versions : null
  if (!versionList || versionList.length === 0) {
    report.error('VERSIONS_INVALID', versionsRel + ' 的 versions 必须是非空数组', versionsRel)
    return
  }
  for (const version of versionList) {
    if (typeof version !== 'string' || !SEMVER_PATTERN.test(version)) {
      report.error('VERSIONS_INVALID', versionsRel + ' 含非法版本号 ' + JSON.stringify(version), versionsRel)
    }
  }
  if (typeof versionsData.latest !== 'string' || !SEMVER_PATTERN.test(versionsData.latest)) {
    report.error('VERSIONS_INVALID', versionsRel + ' 的 latest 不是合法版本号', versionsRel)
  } else if (!versionList.includes(versionsData.latest)) {
    report.error('LATEST_NOT_LISTED', versionsRel + ' 的 latest ' + versionsData.latest + ' 不在 versions 列表内', versionsRel)
  }

  for (const version of versionList) {
    if (typeof version !== 'string') continue
    const versionRel = pluginRel + '/' + version
    const versionDir = join(pluginDir, version)
    if (!isDirectory(versionDir)) {
      report.error('VERSION_DIR_MISSING', '版本目录不存在:' + versionRel, versionRel)
      continue
    }
    stats.versions += 1
    for (const name of VERSION_REQUIRED_FILES) {
      if (!isFile(join(versionDir, name))) {
        report.error('VERSION_FILE_MISSING', versionRel + ' 缺少必需文件 ' + name, versionRel + '/' + name)
      }
    }
    inspectVersionMeta({ versionDir, versionRel, version, pluginName: entry.plugin_name, report })
    inspectVersionAuthorSignatures({
      versionDir,
      versionRel,
      report,
      authorContext,
      plugin: entry.plugin_name,
      version,
      stats,
      signatures,
    })
  }
}

function inspectVersionMeta({ versionDir, versionRel, version, pluginName, report }) {
  const metaPath = join(versionDir, 'meta.json')
  if (!isFile(metaPath)) return
  const meta = parseJsonFile(metaPath, versionRel + '/meta.json', report)
  if (meta === undefined) return
  if (!isObject(meta)) {
    report.error('PLUGIN_META_INVALID', versionRel + '/meta.json 的顶层必须是对象', versionRel + '/meta.json')
    return
  }
  if (meta.name !== pluginName) {
    report.error('PLUGIN_META_MISMATCH', versionRel + '/meta.json 的 name 为 ' + JSON.stringify(meta.name) + ',与 plugins.json 的 ' + pluginName + ' 不一致', versionRel + '/meta.json')
  }
  if (meta.version !== version) {
    report.error('PLUGIN_META_MISMATCH', versionRel + '/meta.json 的 version 为 ' + JSON.stringify(meta.version) + ',与目录名 ' + version + ' 不一致', versionRel + '/meta.json')
  }
}

/**
 * 列出某个被签文件在版本目录内的全部作者签名文件。
 * 命名不合约定的(例如 plugin.js.author.sig.1、plugin.js.author.sig.02)单独返回,
 * 由上层提示后忽略,不参与校验。
 */
function collectAuthorSignatureFiles(versionDir, file) {
  const found = []
  const invalid = []
  const prefix = file + AUTHOR_SIG_SUFFIX
  for (const name of readdirSync(versionDir).sort()) {
    if (!name.startsWith(prefix)) continue
    const index = authorSignerIndexFromSignatureName(name, file)
    if (index === null) invalid.push(name)
    else found.push({ index, name, path: join(versionDir, name) })
  }
  found.sort((left, right) => left.index - right.index)
  return { found, invalid }
}

/**
 * 逐个校验版本目录内的作者签名。
 *
 * 作者签名是可选项:没有作者公钥时不校验也不提示,有作者公钥但缺少签名时只警告,
 * 因为整站签名仍然覆盖 plugin.js。多位签名者按序号逐个校验,任一签名失败只记警告,
 * 既不阻断同版本其他签名者的校验,也不阻断发布(全组织口径:签名失败只警告)。
 * 校验结果连同签名者列表写入 signatures,供界面展示多个签名者。
 *
 * 这里贯彻上面的配对规则:只有签名文件没有公钥时,该签名者记为 ok:false 并写进 signatures;
 * 只有公钥没有签名文件时,该版本文件不写进 signatures——它没有任何签名者,不可能算通过。
 * 两种情形都只警告,不影响退出码。
 */
function inspectVersionAuthorSignatures({ versionDir, versionRel, report, authorContext, plugin, version, stats, signatures }) {
  const { authorRel, keys, hasUsableKey } = authorContext
  for (const file of VERSION_AUTHOR_SIGNED_FILES) {
    const filePath = join(versionDir, file)
    if (!isFile(filePath)) continue
    const fileRel = versionRel + '/' + file
    const { found, invalid } = collectAuthorSignatureFiles(versionDir, file)
    for (const name of invalid) {
      report.warn(
        'AUTHOR_SIGN_NAME_INVALID',
        versionRel + '/' + name + ' 不符合作者签名命名约定,已忽略;多签序号从 2 起写作 ' + file + AUTHOR_SIG_SUFFIX + '.<序号>',
        versionRel + '/' + name,
      )
    }

    const signers = []
    for (const item of found) {
      const signatureRel = versionRel + '/' + item.name
      const publicKeyRel = authorRel + '/' + authorPublicKeyFileName(item.index)
      const key = keys.get(item.index)
      if (!key || !key.usable) {
        const reason = key ? '作者公钥不可用' : '作者公钥缺失'
        report.warn(
          'AUTHOR_SIGN_UNVERIFIABLE',
          signatureRel + ' 存在,但 ' + publicKeyRel + ' ' + (key ? '不可用' : '缺失') + ',第 ' + item.index
            + ' 个签名者无法校验,判为未通过(签名文件与作者公钥两份缺一不可)',
          signatureRel,
        )
        signers.push({ index: item.index, signature: signatureRel, publicKey: publicKeyRel, ok: false, reason })
        continue
      }
      const result = verifyFileAuthor(filePath, item.path, key.path)
      if (!result.ok) {
        report.warn(
          'AUTHOR_SIGN_FAILED',
          signatureRel + ' 校验失败,签名者 ' + item.index + '(' + key.rel + ')与 ' + fileRel + ' 不匹配:' + String(result.reason),
          signatureRel,
        )
      }
      signers.push({
        index: item.index,
        signature: signatureRel,
        publicKey: key.rel,
        ok: result.ok,
        reason: result.ok ? null : String(result.reason),
      })
    }

    if (signers.length === 0) {
      if (hasUsableKey) {
        report.warn(
          'AUTHOR_SIGN_MISSING',
          fileRel + ' 缺少作者签名(' + file + AUTHOR_SIG_SUFFIX + '),该版本只有整站签名,作者签名判为未校验(签名文件与作者公钥两份缺一不可)',
          versionRel,
        )
      }
      continue
    }

    signatures.push({ plugin, version, file, ok: signers.every((item) => item.ok), signers })
    stats.authorSignatures += signers.length
  }
}

/**
 * 把问题列表格式化为可读文本。
 * @param {Array<object>} problems 问题列表
 * @returns {string}
 */
export function formatProblems(problems) {
  return problems
    .map((item) => {
      const level = item.level === 'error' ? '[错误]' : '[警告]'
      const location = item.path ? ' (' + item.path + ')' : ''
      return level + ' ' + item.code + ' ' + item.message + location
    })
    .join('\n')
}
