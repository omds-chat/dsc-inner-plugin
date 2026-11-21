#!/usr/bin/env node
/**
 * 合集自洽性校验,供 CI 与开发者本地使用。
 *
 * 与 build-collection.mjs 共用 lib/collection-verify.mjs 的校验逻辑,只读不写。
 * 校验范围是索引数据、作者签名与每个版本 plugin.js 的产物静态扫描,不需要证书链;
 * 整站签名由 verify-site.mjs 校验。
 *
 * 用法:
 *   node scripts/verify-collection.mjs --dir .
 *   node scripts/verify-collection.mjs --dir . --json
 *
 * 校验之外还做 npm 包名强校验:对 plugins/ 目录形态下的每个插件到 npm registry
 * 确认登记包名(即插件名)存在;查不到按错误拦截,registry 不可达(本地无网)
 * 降级为「跳过在线检查」警告,与社区合集 awesome-dsc-plugin 口径一致。
 */
import { formatProblems, verifyCollection } from './lib/collection-verify.mjs'
import { NPM_REGISTRY_URL, checkNpmPackages, collectInnerPlugins } from './lib/npm-package-check.mjs'
import { resolveNpmRegistryUrl } from './lib/env.mjs'
import { opensslVersion } from './pki.mjs'

function usage() {
  process.stdout.write([
    '用法: node scripts/verify-collection.mjs [选项]',
    '',
    '选项:',
    '  --dir <目录>                合集根目录,默认当前目录',
    '  --registry <地址>           npm registry 地址,默认读环境变量 NPM_REGISTRY_URL(缺省 ' + NPM_REGISTRY_URL + ')',
    '  --skip-npm                  跳过 npm 包名在线检查',
    '  --collection-name <名称>    合集名称,默认取合集目录名',
    '  --json                      以 JSON 输出校验结果',
    '  --help                      显示本说明',
    '',
    '环境变量:',
    '  NPM_REGISTRY_URL            npm registry 地址,等价于 --registry;本地模拟器见 awesome-dsc-plugin 的 scripts/dev/npm-registry-mock.mjs',
    '',
  ].join('\n'))
}

function parseArgs(argv) {
  const options = { dir: '.', registry: resolveNpmRegistryUrl(), skipNpm: false, collectionName: null, json: false, help: false }
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
      case '--collection-name': options.collectionName = take(); break
      case '--json': options.json = true; break
      case '--help':
      case '-h': options.help = true; break
      default: throw new Error('未知参数 ' + arg)
    }
  }
  return options
}

async function main() {
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

  try {
    const version = opensslVersion()
    if (version.major < 3) {
      process.stderr.write('校验失败:需要 OpenSSL 3.0 及以上,当前为 ' + version.text + '\n')
      return 2
    }
  } catch (error) {
    process.stderr.write('校验失败:' + error.message + '\n')
    return 2
  }

  const result = verifyCollection(options.dir, { collectionName: options.collectionName })

  // npm 包名强校验:登记包名(即插件名)必须在 registry 上存在。
  // plugins/ 目录缺失或为空时索引本来就是空的,不额外报错;registry 不可达降级为警告。
  let npmStats
  if (options.skipNpm) {
    npmStats = { skipped: true }
  } else {
    const plugins = collectInnerPlugins(options.dir)
    npmStats = await checkNpmPackages({
      plugins,
      problems: result.problems,
      registryUrl: options.registry,
    })
  }
  const npmErrors = result.problems.filter((item) => item.level === 'error').length
  result.errorCount = npmErrors
  result.warningCount = result.problems.length - npmErrors
  result.ok = npmErrors === 0
  result.npm = npmStats

  if (options.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  } else {
    if (result.problems.length > 0) process.stdout.write(formatProblems(result.problems) + '\n')
    if (result.signatures.length > 0) {
      const signerTotal = result.signatures.reduce((sum, item) => sum + item.signers.length, 0)
      const signerFailed = result.signatures.reduce(
        (sum, item) => sum + item.signers.filter((signer) => !signer.ok).length,
        0,
      )
      process.stdout.write(
        '作者签名: ' + result.signatures.length + ' 个文件,' + signerTotal + ' 个签名者,未通过 ' + signerFailed + ' 个\n',
      )
    }
    const npmSummary = npmStats.skipped === true
      ? ',npm 包名检查跳过'
      : ',npm 包名检查 ' + npmStats.registered + ' 个' +
        (npmStats.offlineSkipped > 0 ? '(registry 不可达,跳过 ' + npmStats.offlineSkipped + ' 个在线查询)' : '') +
        (npmStats.missing > 0 ? ',包不存在 ' + npmStats.missing + ' 个' : '')
    const summary =
      '合集 ' + result.collectionName + ':' +
      result.stats.authors + ' 个作者,' +
      result.stats.plugins + ' 个插件,' +
      result.stats.versions + ' 个版本,' +
      '产物静态扫描 ' + result.stats.scannedScripts + ' 个 plugin.js,命中 ' + result.stats.networkHits + ' 处' +
      npmSummary
    if (result.ok) {
      process.stdout.write('校验通过 ' + summary + ',警告 ' + result.warningCount + ' 条\n')
    } else {
      process.stdout.write('校验未通过 ' + summary + ',错误 ' + result.errorCount + ' 条,警告 ' + result.warningCount + ' 条\n')
    }
  }

  return result.ok ? 0 : 1
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (error) => {
    process.stderr.write('校验失败:' + (error && error.message ? error.message : String(error)) + '\n')
    process.exitCode = 1
  },
)
