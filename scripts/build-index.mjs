#!/usr/bin/env node
/**
 * 生成 DeepSeek-Chat-Enhanced 插件市场可直接消费的插件索引。
 *
 * 输入: plugins/*.json
 * 输出: dist/index.json 与 dist/plugins/*.json
 *
 * 任何一条不合法都以非零退出码结束,并且不写出索引文件。
 */

import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCHEMA_VERSION = 1
const ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/
const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+$/
const HTTPS_PATTERN = /^https:\/\/[^\s]+$/i
const HTTP_PATTERN = /^https?:\/\/[^\s]+$/i

const REQUIRED_TEXT_FIELDS = ['name', 'description', 'author']

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginsDir = path.join(rootDir, 'plugins')
const distDir = path.join(rootDir, 'dist')
const distPluginsDir = path.join(distDir, 'plugins')

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBlank(value) {
  return typeof value !== 'string' || value.trim() === ''
}

function isRelativePath(value) {
  const raw = value.trim().replace(/\\/g, '/')
  if (raw === '' || raw.includes('://')) return false
  if (raw.startsWith('/')) return false
  const normalized = raw.replace(/^\.\//, '')
  if (normalized === '') return false
  const segments = normalized.split('/')
  return segments.every(function (segment) {
    return segment !== '' && segment !== '.' && segment !== '..'
  })
}

function validateEntry(entry, fileName) {
  const problems = []

  if (!isPlainObject(entry)) {
    problems.push('顶层必须是 JSON 对象')
    return problems
  }

  if (isBlank(entry.id)) {
    problems.push('缺少必填字段 id,或 id 不是非空字符串')
  } else if (!ID_PATTERN.test(entry.id)) {
    problems.push('id "' + entry.id + '" 不符合规则 ' + ID_PATTERN.source)
  } else if (fileName !== entry.id + '.json') {
    problems.push('文件名 ' + fileName + ' 与 id 不一致,应为 ' + entry.id + '.json')
  }

  for (const field of REQUIRED_TEXT_FIELDS) {
    if (isBlank(entry[field])) {
      problems.push('缺少必填字段 ' + field + ',或该字段不是非空字符串')
    }
  }

  if (isBlank(entry.version)) {
    problems.push('缺少必填字段 version,或该字段不是非空字符串')
  } else if (!VERSION_PATTERN.test(entry.version)) {
    problems.push('version "' + entry.version + '" 不是三段数字')
  }

  if (isBlank(entry.homepage)) {
    problems.push('缺少必填字段 homepage,或该字段不是非空字符串')
  } else if (!HTTP_PATTERN.test(entry.homepage.trim())) {
    problems.push('homepage "' + entry.homepage + '" 必须是 http 或 https 地址')
  }

  if (isBlank(entry.download)) {
    problems.push('缺少必填字段 download,或该字段不是非空字符串')
  } else if (!HTTPS_PATTERN.test(entry.download.trim()) && !isRelativePath(entry.download)) {
    problems.push('download "' + entry.download + '" 必须是 https 地址或本仓库相对路径')
  }

  if (entry.manifest !== undefined && !isPlainObject(entry.manifest)) {
    problems.push('manifest 必须是对象')
  }

  return problems
}

function toIndexItem(entry) {
  const item = {
    id: entry.id.trim(),
    name: entry.name.trim(),
    version: entry.version.trim(),
    description: entry.description.trim(),
    author: entry.author.trim(),
    homepage: entry.homepage.trim(),
    download: entry.download.trim(),
  }
  if (isPlainObject(entry.manifest)) {
    item.manifest = entry.manifest
  }
  return item
}

async function listEntryFiles() {
  let dirents
  try {
    dirents = await readdir(pluginsDir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('缺少目录 plugins/,无法生成索引')
    }
    throw error
  }
  return dirents
    .filter(function (dirent) {
      return dirent.isFile() && dirent.name.endsWith('.json')
    })
    .map(function (dirent) {
      return dirent.name
    })
    .sort()
}

async function clearGeneratedJson() {
  await mkdir(distPluginsDir, { recursive: true })
  await rm(path.join(distDir, 'index.json'), { force: true })
  const existing = await readdir(distPluginsDir)
  for (const name of existing) {
    if (name.endsWith('.json')) {
      await rm(path.join(distPluginsDir, name), { force: true })
    }
  }
}

async function main() {
  const fileNames = await listEntryFiles()
  const failures = []
  const accepted = []
  const seen = new Map()

  for (const fileName of fileNames) {
    const filePath = path.join(pluginsDir, fileName)
    let entry
    try {
      entry = JSON.parse(await readFile(filePath, 'utf8'))
    } catch (error) {
      failures.push('plugins/' + fileName + ': JSON 解析失败 - ' + error.message)
      continue
    }

    const problems = validateEntry(entry, fileName)
    if (problems.length > 0) {
      for (const message of problems) {
        failures.push('plugins/' + fileName + ': ' + message)
      }
      continue
    }

    const id = entry.id.trim()
    if (seen.has(id)) {
      failures.push('plugins/' + fileName + ': id "' + id + '" 与 plugins/' + seen.get(id) + ' 重复')
      continue
    }
    seen.set(id, fileName)
    accepted.push({ fileName: fileName, item: toIndexItem(entry) })
  }

  if (failures.length > 0) {
    console.error('索引生成失败: ' + failures.length + ' 处问题,未写出 dist/index.json')
    for (const message of failures) {
      console.error('  ' + message)
    }
    process.exitCode = 1
    return
  }

  accepted.sort(function (left, right) {
    if (left.item.id < right.item.id) return -1
    if (left.item.id > right.item.id) return 1
    return 0
  })

  await clearGeneratedJson()

  const index = {
    schemaVersion: SCHEMA_VERSION,
    plugins: accepted.map(function (entry) {
      return entry.item
    }),
  }
  await writeFile(path.join(distDir, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8')

  for (const entry of accepted) {
    await copyFile(
      path.join(pluginsDir, entry.fileName),
      path.join(distPluginsDir, entry.fileName),
    )
  }

  console.log('索引生成完成: ' + index.plugins.length + ' 个插件')
  for (const entry of accepted) {
    console.log('  ' + entry.item.id + '@' + entry.item.version + ' <- plugins/' + entry.fileName)
  }
  console.log('输出: dist/index.json')
  console.log('输出: dist/plugins/ 条目副本 ' + accepted.length + ' 个')
}

main().catch(function (error) {
  console.error('索引生成失败: ' + (error && error.message ? error.message : String(error)))
  process.exitCode = 1
})
