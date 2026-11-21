#!/usr/bin/env node
/**
 * 发版前预检:一次性跑完本索引全部可本地自检项,汇总输出,供维护者在 PR 前自查。
 *
 * 检查项(判定逻辑全部复用既有模块,不另立规则):
 *   index  索引结构:plugins.json、author_manifest.json、版本目录与作者签名
 *          (作者签名失败只警告,全组织口径;verifyCollection 已内置)
 *   npm    npm 包名强校验:登记包名(即插件名)在 registry 上存在
 *   scan   产物静态扫描:plugin.js 网络自建调用,命中只记警告
 *
 * 全部检查不需要证书链与任何私钥;npm 检查在本地无网时降级为「跳过在线检查」警告,
 * CI 联网时查不到包按错误拦截。任何 error 级问题都使退出码为 1。
 *
 * 用法:
 *   node scripts/preflight.mjs
 *   node scripts/preflight.mjs --comment preflight-comment.md
 *   node scripts/preflight.mjs --json
 *
 * 选项:
 *   --dir <目录>       合集根目录,默认当前目录
 *   --registry <地址>  npm registry 地址,默认读环境变量 NPM_REGISTRY_URL(缺省官方源)
 *   --skip-npm         跳过 npm 包名在线检查
 *   --comment <路径>   同时把报告写成 PR 评论 Markdown(工作流用)
 *   --json             以 JSON 输出汇总
 *   --help             显示本说明
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { verifyCollection } from './lib/collection-verify.mjs'
import { NPM_REGISTRY_URL, checkNpmPackages, collectInnerPlugins } from './lib/npm-package-check.mjs'
import { resolveNpmRegistryUrl } from './lib/env.mjs'
import { NETWORK_SELFTALK_CODE as PLUGIN_NETWORK_SELFTALK } from './lib/plugin-network-scan.mjs'
import { formatPreflightComment, PREFLIGHT_COMMENT_MARKER } from './lib/preflight-comment.mjs'

function usage() {
  process.stdout.write([
    '用法: node scripts/preflight.mjs [选项]',
    '',
    '选项:',
    '  --dir <目录>       合集根目录,默认当前目录',
    '  --registry <地址>  npm registry 地址,默认读环境变量 NPM_REGISTRY_URL(缺省 ' + NPM_REGISTRY_URL + ')',
    '  --skip-npm         跳过 npm 包名在线检查',
    '  --comment <路径>   同时把报告写成 PR 评论 Markdown,固定标记见 lib/preflight-comment.mjs',
    '  --json             以 JSON 输出汇总',
    '  --help             显示本说明',
    '',
    '环境变量:',
    '  NPM_REGISTRY_URL   npm registry 地址,等价于 --registry;本地模拟器见 awesome-dsc-plugin 的 scripts/dev/npm-registry-mock.mjs',
    '',
  ].join('\n'))
}

function parseArgs(argv) {
  const options = { dir: '.', registry: resolveNpmRegistryUrl(), skipNpm: false, comment: null, json: false, help: false }
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
      case '--registry': options.registry = take(); break
      case '--skip-npm': options.skipNpm = true; break
      case '--comment': options.comment = take(); break
      case '--json': options.json = true; break
      case '--help':
      case '-h': options.help = true; break
      default: throw new Error('未知参数 ' + arg)
    }
  }
  return options
}

/** 构造单个检查项结果并归一化问题记录。 */
function buildCheck(name, title, problems, stats = {}) {
  const normalized = problems.map((item) => ({
    level: item.level,
    code: String(item.code),
    path: item.path == null ? null : String(item.path).split('\\').join('/'),
    message: String(item.message),
  }))
  const errors = normalized.filter((item) => item.level === 'error').length
  return {
    name,
    title,
    ok: errors === 0,
    counts: { errors, warnings: normalized.length - errors, problems: normalized.length },
    problems: normalized,
    stats,
  }
}

async function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    process.stderr.write('参数错误:' + error.message + '\n\n')
    usage()
    return 2
  }
  if (options.help) {
    usage()
    return 0
  }

  const root = resolve(options.dir)

  // 索引结构与产物静态扫描共用一次 verifyCollection:扫描问题(PLUGIN_NETWORK_SELFTALK)拆出单列
  const verification = verifyCollection(root, {})
  const indexProblems = verification.problems.filter((item) => item.code !== PLUGIN_NETWORK_SELFTALK)
  const scanProblems = verification.problems.filter((item) => item.code === PLUGIN_NETWORK_SELFTALK)
  const indexCheck = buildCheck('index', '索引结构(plugins.json、作者与版本目录、作者签名)', indexProblems, {
    authors: verification.stats.authors,
    plugins: verification.stats.plugins,
    versions: verification.stats.versions,
    scannedScripts: verification.stats.scannedScripts,
  })
  const scanCheck = buildCheck('scan', '产物静态扫描(plugin.js 网络自建)', scanProblems, {
    scannedScripts: verification.stats.scannedScripts,
    hits: verification.stats.networkHits,
  })

  // npm 包名强校验:登记包名(即插件名)在 registry 上存在;无网时降级为警告
  const npmProblems = []
  const npmStats = await checkNpmPackages({
    plugins: collectInnerPlugins(root),
    problems: npmProblems,
    registryUrl: options.registry,
    skip: options.skipNpm,
  })
  const npmCheck = buildCheck('npm', 'npm 包名(登记包名与插件名一致且已发布)', npmProblems, {
    ...npmStats,
    skippedNote: options.skipNpm ? '已用 --skip-npm 跳过' : undefined,
  })

  const checks = [indexCheck, npmCheck, scanCheck]
  const errorCount = checks.reduce((sum, item) => sum + item.counts.errors, 0)
  const warningCount = checks.reduce((sum, item) => sum + item.counts.warnings, 0)
  const summary = {
    ok: errorCount === 0,
    check: 'preflight',
    title: '发版前预检',
    target: process.cwd(),
    counts: { errors: errorCount, warnings: warningCount, problems: errorCount + warningCount },
    checks,
    problems: checks.flatMap((item) => item.problems.map((problem) => ({ check: item.name, ...problem }))),
    stats: { checks: checks.length },
    generatedAt: new Date().toISOString(),
  }

  if (options.json) {
    process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
  } else {
    process.stdout.write('== 发版前预检 ==\n')
    for (const item of checks) {
      process.stdout.write(
        (item.ok ? '[通过] ' : '[未通过] ') + item.name + ' ' + item.title +
          ':错误 ' + item.counts.errors + ' 条,警告 ' + item.counts.warnings + ' 条\n',
      )
      for (const problem of item.problems) {
        const level = problem.level === 'error' ? '  [错误] ' : '  [警告] '
        const location = problem.path ? '(' + problem.path + ')' : ''
        process.stdout.write(level + problem.code + ' ' + problem.message + ' ' + location + '\n')
      }
    }
    process.stdout.write(
      (summary.ok ? '预检通过:' : '预检未通过:') + '错误 ' + errorCount + ' 条,警告 ' + warningCount + ' 条\n',
    )
  }

  // 评论文件在退出码判定之前写出:预检失败时工作流也要把失败结果更新到 PR 同一楼
  if (options.comment) {
    const comment = PREFLIGHT_COMMENT_MARKER + '\n' + formatPreflightComment(summary)
    writeFileSync(options.comment, comment, 'utf8')
    process.stdout.write('预检评论已写入 ' + options.comment + '\n')
  }

  return summary.ok ? 0 : 1
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (error) => {
    process.stderr.write('预检失败:' + (error && error.message ? error.message : String(error)) + '\n')
    process.exitCode = 2
  },
)
