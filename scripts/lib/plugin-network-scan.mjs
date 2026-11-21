/**
 * 插件产物的静态扫描:插件不得自建网络通道。
 *
 * 扫描对象是产物 plugin.js 的文本,不是插件的运行行为。这是一道收录侧门禁:
 * 命中即判错误码 PLUGIN_NETWORK_SELFTALK,让 pnpm verify 与 pnpm build 在写出 dist/ 之前失败,
 * pnpm run import 则跳过该插件。扫描器不执行插件、不联网、不需要任何证书,也不做运行时拦截。
 *
 * 匹配口径只认全局对象上的直接调用,以压低误伤:
 * - 标识符前面不是标识符字符、也不是点号,算全局对象上的直接调用;
 * - 标识符前面是点号时,点号前的名字必须是 window、globalThis、self、global,
 *   例如 window.fetch( 命中,client.fetch( 与 this.fetch( 不命中;
 * - navigator.sendBeacon 是唯一按成员写法匹配的规则,点号前必须是 navigator。
 *
 * 只有标识符后面跟着左括号才算调用。单纯取引用(例如 const f = fetch)不命中,
 * 这是刻意的取舍:只匹配调用形态,避免把特性探测与文档字符串一并当成调用。
 *
 * 扫描不做语法分析,注释、字符串与模板字面量里的同形文字同样会命中。
 * 这是已知的误伤面,处置方式是改写那段文字,不是放宽规则;已知盲区写在 README 的「产物静态扫描」一节。
 */

/** 命中时的错误码。收录与发布侧门禁,不是运行时拦截 */
export const NETWORK_SELFTALK_CODE = 'PLUGIN_NETWORK_SELFTALK'

/** 点号前出现这些名字时,仍算访问全局对象 */
export const GLOBAL_OBJECTS = ['window', 'globalThis', 'self', 'global']

/**
 * 标识符类规则。
 * name 是必须出现的标识符,member 非空时要求点号前就是这个成员宿主。
 */
const IDENTIFIER_RULES = [
  { id: 'fetch', name: 'fetch', member: null },
  { id: 'xml-http-request', name: 'XMLHttpRequest', member: null },
  { id: 'websocket', name: 'WebSocket', member: null },
  { id: 'event-source', name: 'EventSource', member: null },
  { id: 'send-beacon', name: 'sendBeacon', member: 'navigator' },
]

/** 规则表元数据,供文档与实现对照 */
export const NETWORK_CALL_RULES = IDENTIFIER_RULES.map((rule) => ({ ...rule }))

/** 远程地址前缀:动态导入只拦协议地址与协议相对地址 */
const REMOTE_ADDRESS_PATTERN = /^(?:https?:)?\/\//i

/** 标识符字符,比 \w 多一个 $,与 JavaScript 的标识符首尾判定对齐 */
const IDENTIFIER_CHAR = /[A-Za-z0-9_$]/

/** 单条命中里字面量与摘录的长度上限,避免把整行压缩后的脚本搬进报告 */
const LITERAL_LIMIT = 80
const EXCERPT_LIMIT = 120
const DEFAULT_MAX_HITS = 32

function isIdentifierChar(char) {
  return typeof char === 'string' && char !== '' && IDENTIFIER_CHAR.test(char)
}

/** 取 end(不含)之前的那个标识符,end 通常指向点号 */
function identifierBefore(source, end) {
  let index = end
  while (index > 0 && isIdentifierChar(source[index - 1])) index -= 1
  return source.slice(index, end)
}

function clip(text, limit) {
  const value = text.replace(/\s+/g, ' ').trim()
  return value.length > limit ? value.slice(0, limit - 1) + '…' : value
}

/** 每行起始偏移,用于把字符下标换算成行列 */
function computeLineStarts(source) {
  const starts = [0]
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') starts.push(index + 1)
  }
  return starts
}

function positionOf(lineStarts, index) {
  let low = 0
  let high = lineStarts.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (lineStarts[middle] <= index) low = middle + 1
    else high = middle - 1
  }
  const lineIndex = Math.max(high, 0)
  return { line: lineIndex + 1, column: index - lineStarts[lineIndex] + 1 }
}

function excerptOf(source, lineStarts, line) {
  const start = lineStarts[line - 1]
  const end = line < lineStarts.length ? lineStarts[line] - 1 : source.length
  return clip(source.slice(start, end), EXCERPT_LIMIT)
}

/**
 * 扫一个标识符规则。
 * 命中条件: 前置边界成立(全局直接调用或全局对象成员)、后跟左括号。
 */
function scanIdentifierRule(source, rule, record) {
  const pattern = new RegExp('\\b' + rule.name + '\\b', 'g')
  let match
  while ((match = pattern.exec(source)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (isIdentifierChar(source[start - 1]) || isIdentifierChar(source[end])) continue

    let literalStart = start
    const before = source[start - 1]
    if (before === '.') {
      const owner = identifierBefore(source, start - 1)
      if (owner === '') continue
      if (rule.member) {
        if (owner !== rule.member) continue
      } else if (!GLOBAL_OBJECTS.includes(owner)) {
        // client.fetch(、this.fetch( 之类的成员调用不属全局对象,不命中
        continue
      }
      literalStart = start - owner.length - 1
    } else if (rule.member) {
      // navigator.sendBeacon 必须带宿主,单独写 sendBeacon( 不命中
      continue
    }

    const callHead = /^[ \t]*\(/.exec(source.slice(end, end + 16))
    if (!callHead) continue
    record(rule, literalStart, end + callHead[0].length)
  }
}

/** 扫 import( 远程地址:只认字符串字面量里的协议地址与协议相对地址 */
function scanRemoteDynamicImport(source, record) {
  const pattern = /\bimport[ \t]*\([ \t]*(['"`])([^'"`\n]*)\1/g
  let match
  while ((match = pattern.exec(source)) !== null) {
    const start = match.index
    if (isIdentifierChar(source[start - 1])) continue
    if (!REMOTE_ADDRESS_PATTERN.test(match[2])) continue
    // 字面量后面跟着右括号时一并纳入命中,报告里直接给出完整的 import('...') 形态
    const tail = /^[ \t]*\)/.exec(source.slice(start + match[0].length, start + match[0].length + 16))
    const end = start + match[0].length + (tail ? tail[0].length : 0)
    record({ id: 'remote-dynamic-import', name: 'import', member: null }, start, end)
  }
}

/**
 * 扫描一段插件脚本。
 * @param {string} source 插件脚本文本
 * @param {object} [options] 选项
 * @param {number} [options.maxHits] 逐条列出的命中上限,超出部分只计数,默认 32
 * @returns {{ok: boolean, code: string, hitCount: number, hits: Array<{rule: string, literal: string, line: number, column: number, excerpt: string}>, truncated: boolean}}
 */
export function scanNetworkSelfTalk(source, options = {}) {
  const text = typeof source === 'string' ? source : ''
  const maxHits = Number.isInteger(options.maxHits) && options.maxHits > 0 ? options.maxHits : DEFAULT_MAX_HITS
  const raw = []
  const record = (rule, start, end) => raw.push({ ruleId: rule.id, start, end })

  for (const rule of IDENTIFIER_RULES) scanIdentifierRule(text, rule, record)
  scanRemoteDynamicImport(text, record)
  raw.sort((left, right) => left.start - right.start)

  const lineStarts = computeLineStarts(text)
  const hits = []
  for (const item of raw) {
    if (hits.length >= maxHits) break
    const position = positionOf(lineStarts, item.start)
    hits.push({
      rule: item.ruleId,
      literal: clip(text.slice(item.start, item.end), LITERAL_LIMIT),
      line: position.line,
      column: position.column,
      excerpt: excerptOf(text, lineStarts, position.line),
    })
  }

  return {
    ok: raw.length === 0,
    code: NETWORK_SELFTALK_CODE,
    hitCount: raw.length,
    hits,
    truncated: raw.length > hits.length,
  }
}

/** 把一条命中写成「第 N 行第 M 列 字面量」,校验与收录两侧共用同一措辞 */
export function describeNetworkHit(hit) {
  return '第 ' + hit.line + ' 行第 ' + hit.column + ' 列 ' + hit.literal
}
