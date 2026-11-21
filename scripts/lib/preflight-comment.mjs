/**
 * 发版前预检报告的 PR 评论文本生成(内部插件索引)。
 *
 * preflight.mjs 汇总本地自检结果后,由本模块把同一份 JSON 渲染成 Markdown 评论:
 * CI 侧的工作流读取这份文本,用固定标记(见 PREFLIGHT_COMMENT_MARKER)在 PR 上
 * 查找既有评论并更新同楼,不新增楼层;通过与未通过都更新同一条评论。
 * 本模块只做纯文本渲染,不发任何请求,便于离线夹具测试。
 */

/** PR 评论的固定标记:工作流按这行 HTML 注释查找既有评论,修改时两端必须同步 */
export const PREFLIGHT_COMMENT_MARKER = '<!-- awesome-dsc-plugin-preflight -->'

/**
 * 把预检汇总渲染成 PR 评论 Markdown。
 * 输出以结论、居中表格与问题清单构成;无问题时列出通过项,不伪造问题。
 * @param {object} summary preflight.mjs 的汇总结果
 * @param {boolean} summary.ok 是否通过(无 error 级问题)
 * @param {Array<{name: string, title: string, ok: boolean, counts: {errors: number, warnings: number}, problems: Array<object>}>} summary.checks 检查项列表
 * @param {string} [summary.generatedAt] 生成时间(ISO 字符串)
 * @returns {string} Markdown 文本(不含固定标记行,工作流拼接时自行加上标记)
 */
export function formatPreflightComment(summary) {
  const lines = []
  lines.push('## 发版前预检报告(preflight)')
  lines.push('')
  lines.push('**结论:' + (summary.ok ? '预检通过' : '预检未通过') + '**')
  lines.push('')
  lines.push('| 检查项 | 判定 | 错误 | 警告 |')
  lines.push('|:---:|:---:|:---:|:---:|')
  for (const check of summary.checks) {
    lines.push('| ' + check.title + ' | ' + (check.ok ? '通过' : '未通过') + ' | ' + check.counts.errors + ' | ' + check.counts.warnings + ' |')
  }
  const problems = summary.checks.flatMap((check) => check.problems.map((item) => ({ ...item, check: check.name })))
  if (problems.length > 0) {
    lines.push('')
    lines.push('### 问题清单')
    lines.push('')
    for (const item of problems) {
      const level = item.level === 'error' ? '[错误]' : '[警告]'
      const location = item.path ? '(' + item.path + ')' : ''
      lines.push('- ' + level + ' ' + item.code + ' ' + item.message + ' ' + location)
    }
  } else {
    lines.push('')
    lines.push('全部检查项无错误、无警告。')
  }
  lines.push('')
  lines.push('判定口径:错误级问题会让本预检与 CI 拦截收录;警告只提示、不改变结论。')
  lines.push('本评论由 preflight 工作流自动维护,固定更新这一楼,不新增楼层。' +
    (summary.generatedAt ? '(生成于 ' + summary.generatedAt + ')' : ''))
  return lines.join('\n')
}
