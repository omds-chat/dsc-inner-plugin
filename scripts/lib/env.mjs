/**
 * 极简 .env 读取与 npm registry 地址解析:dotenv 风格的子集,零依赖。
 *
 * 与 awesome-dsc-plugin 仓库的 scripts/lib/env.mjs 同一份逻辑,保持两个
 * 仓库的校验脚本默认值行为一致。仓库不引入任何依赖,也没有 dotenv 包:
 * 本模块按 dotenv 的常见格式手动解析仓库根的 .env(每行 KEY=VALUE,
 * # 开头是注释,值支持成对单双引号与行内注释),只填充 process.env 里
 * 尚未设置的键——真实环境变量始终优先于 .env。.env 不进 git
 * (.gitignore 已排除),模板见仓库根 .env.example。
 *
 * npm 校验脚本(preflight、verify-collection)的 --registry 默认值统一
 * 走 resolveNpmRegistryUrl():环境变量 NPM_REGISTRY_URL(含仓库根 .env)
 * 优先,缺省回落官方源。本地 registry 模拟器在 awesome-dsc-plugin 仓库:
 * 组织仓库 tools/dev-local-npmjs/dev-local-npmjs.mjs(默认端口 61116)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NPM_REGISTRY_URL } from './npm-package-check.mjs'

const moduleDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(moduleDir, '..', '..')

/** 键名规则:与常见 .env 写法一致,字母或下划线开头,后续是字母、数字、下划线 */
const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * 解析 .env 格式文本为键值对。
 * # 开头是整行注释;未加引号的值去掉行内 # 之后的注释与首尾空白;
 * 成对单双引号包裹的值原样保留内部内容;解析不了的行静默跳过。
 * @param {string} text .env 文本
 * @returns {Record<string, string>} 键值对
 */
export function parseDotEnv(text) {
  const values = {}
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    if (!KEY_PATTERN.test(key)) continue
    let value = line.slice(separator + 1).trim()
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    if (quoted) {
      value = value.slice(1, -1)
    } else {
      const hash = value.indexOf(' #')
      if (hash !== -1) value = value.slice(0, hash).trim()
    }
    values[key] = value
  }
  return values
}

/**
 * 读取 .env 并填充 process.env:已存在的环境变量优先,不被 .env 覆盖。
 * 文件不存在时静默返回,不当作错误。
 * @param {string} [path] .env 路径,默认仓库根 .env
 */
export function loadDotEnv(path = join(repoRoot, '.env')) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return
  }
  for (const [key, value] of Object.entries(parseDotEnv(text))) {
    if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value
  }
}

/**
 * 解析 npm registry 默认地址:命令行未给 --registry 时由各校验脚本调用。
 * 优先级:环境变量 NPM_REGISTRY_URL(含仓库根 .env)→ 官方源。
 * @returns {string} registry 地址
 */
export function resolveNpmRegistryUrl() {
  loadDotEnv()
  const value = process.env.NPM_REGISTRY_URL
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  return NPM_REGISTRY_URL
}
