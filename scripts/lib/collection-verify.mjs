/**
 * 合集自洽性校验(作者签名版)。
 *
 * 校验对象是本仓库的索引目录结构:根目录元数据、作者公钥、插件清单、版本目录与作者分离签名。
 * 只读取文件,不修改任何内容;build-collection.mjs 与 verify-collection.mjs 共用本模块。
 *
 * 本仓库不再持有「合集 EEC 签发插件」这一层:插件文件的信任由两层构成,
 * 一是 dsc 作为作者用 Ed25519 裸公钥给的 *.author.sig,由本脚本校验;
 * 二是 dsc 用网页 EEC 给 dist/ 整站产物做的 CMS 分离签名,由 sign-site.mjs 产出、
 * verify-site.mjs 校验。因此本脚本只校验索引与作者签名,不再要求任何证书链。
 *
 * 校验语义:本脚本是发布前的强校验,任一项失败都以非零退出码结束;
 * 插件市场一侧的同类校验失败只警告,不阻断。
 */
import { readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import {
  AUTHOR_PUB_FILE,
  VERSION_SIGNED_FILES,
  authorSignaturePath,
  describePublicKey,
  verifyFileAuthor,
} from '../pki.mjs'

/** 合集根目录必需的文件 */
export const ROOT_REQUIRED_FILES = ['meta.json', 'plugins.json']
/** 版本目录内必需的文件,作者签名不在其中 */
export const VERSION_REQUIRED_FILES = ['meta.json', 'plugin.js']
/** 作者目录内的公钥文件名 */
export const AUTHOR_PUB_RELATIVE = AUTHOR_PUB_FILE

export { VERSION_SIGNED_FILES }

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
 * @returns {{ok: boolean, root: string, collectionName: string, errorCount: number, warningCount: number, problems: Array<object>, stats: object}}
 */
export function verifyCollection(collectionDir, options = {}) {
  const root = resolve(collectionDir)
  const problems = []
  const stats = { authors: 0, plugins: 0, versions: 0 }
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
    inspectPlugin({ authorContext, entry, report, stats })
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
  const pubRel = authorRel + '/' + AUTHOR_PUB_FILE
  const pubPath = join(authorDir, AUTHOR_PUB_FILE)
  let publicKeyUsable = false
  if (!isFile(pubPath)) {
    report.warn('AUTHOR_PUB_MISSING', '作者公钥不存在:' + pubRel + ',该作者的插件不能带作者签名', pubRel)
  } else {
    try {
      const info = describePublicKey(pubPath)
      publicKeyUsable = true
      if (info.type !== 'ed25519') {
        report.warn('AUTHOR_PUB_TYPE', pubRel + ' 不是 Ed25519 公钥,约定作者密钥为 Ed25519,实际为 ' + info.firstLine, pubRel)
      }
    } catch (error) {
      report.error('AUTHOR_PUB_INVALID', pubRel + ' 不是合法的 PEM 公钥:' + error.message, pubRel)
    }
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
  return { author, authorDir, authorRel, pubPath, pubRel, publicKeyUsable, manifestPlugins }
}

function inspectPlugin({ authorContext, entry, report, stats }) {
  const { author, authorDir, authorRel, pubPath, pubRel, publicKeyUsable } = authorContext
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
    inspectVersionSignatures({ versionDir, versionRel, report, authorPubPath: pubPath, authorPubRel: pubRel, authorPubUsable: publicKeyUsable, author })
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
 * 校验版本目录内的作者签名。
 * 作者签名是可选项:没有作者公钥时不校验也不警告,有作者公钥但缺少签名时只警告,
 * 因为整站签名仍然覆盖这两个文件。
 */
function inspectVersionSignatures({ versionDir, versionRel, report, authorPubPath, authorPubRel, authorPubUsable, author }) {
  const unsigned = []
  for (const name of VERSION_SIGNED_FILES) {
    const filePath = join(versionDir, name)
    if (!isFile(filePath)) continue
    const rel = versionRel + '/' + name
    const authorSigPath = authorSignaturePath(filePath)
    if (!isFile(authorSigPath)) {
      unsigned.push(name)
      continue
    }
    if (!authorPubUsable) {
      report.error(
        'AUTHOR_PUB_MISSING',
        rel + '.author.sig 存在,但 ' + authorPubRel + ' 缺失或不可用,无法校验作者签名',
        rel + '.author.sig',
      )
      continue
    }
    const result = verifyFileAuthor(filePath, authorSigPath, authorPubPath)
    if (!result.ok) {
      report.error('AUTHOR_SIGN_FAILED', rel + '.author.sig 校验失败,作者 ' + author + ' 的签名与文件不匹配:' + String(result.reason), rel + '.author.sig')
    }
  }
  if (authorPubUsable && unsigned.length > 0) {
    report.warn('AUTHOR_SIGN_MISSING', versionRel + ' 缺少作者签名: ' + unsigned.join('、') + ',这两个文件只有整站签名', versionRel)
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
