#!/usr/bin/env node
/**
 * 构建静态站点。
 *
 * 步骤: 清空 dist,打包 src/main.ts 到 dist/assets/main.js,复制样式与页面,写入 .nojekyll。
 * 本脚本会清空整个 dist,所以索引生成必须在本脚本之后执行,见 README。
 */

import { build } from 'esbuild'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)))
const srcDir = path.join(rootDir, 'src')
const distDir = path.join(rootDir, 'dist')
const assetsDir = path.join(distDir, 'assets')

async function main() {
  await rm(distDir, { recursive: true, force: true })
  await mkdir(assetsDir, { recursive: true })

  await build({
    entryPoints: [path.join(srcDir, 'main.ts')],
    outfile: path.join(assetsDir, 'main.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    legalComments: 'none',
    logLevel: 'warning',
  })

  await cp(path.join(srcDir, 'styles.css'), path.join(assetsDir, 'styles.css'))
  await cp(path.join(srcDir, 'index.html'), path.join(distDir, 'index.html'))
  await writeFile(path.join(distDir, '.nojekyll'), '', 'utf8')

  console.log('站点构建完成: dist/index.html')
  console.log('站点构建完成: dist/assets/main.js')
  console.log('站点构建完成: dist/assets/styles.css')
}

main().catch(function (error) {
  console.error('站点构建失败: ' + (error && error.message ? error.message : String(error)))
  process.exitCode = 1
})
