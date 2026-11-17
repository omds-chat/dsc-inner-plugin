import { messages } from './i18n'
import type { Lang, Messages } from './i18n'

const LANG_KEY = 'dsc-inner-plugin:lang'
const HINT_MS = 2400

interface PluginEntry {
  id: string
  name: string
  version: string
  description: string
  author: string
  homepage: string
  download: string
}

let lang: Lang = readLang()
let entries: PluginEntry[] | null = null
let failed = false
let requestId = 0

function readLang(): Lang {
  try {
    const saved = window.localStorage.getItem(LANG_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch {
    /* 本地存储不可用时按浏览器语言决定 */
  }
  const nav = (navigator.language || '').toLowerCase()
  return nav.startsWith('zh') ? 'zh' : 'en'
}

function writeLang(next: Lang): void {
  try {
    window.localStorage.setItem(LANG_KEY, next)
  } catch {
    /* 本地存储不可用时忽略 */
  }
}

function mustGet(id: string): HTMLElement {
  const node = document.getElementById(id)
  if (node === null) throw new Error('缺少节点 ' + id)
  return node
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function isEntry(value: unknown): value is PluginEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  const keys = ['id', 'name', 'version', 'description', 'author', 'homepage', 'download']
  return keys.every(function (key) {
    const field = entry[key]
    return typeof field === 'string' && field.trim() !== ''
  })
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard !== undefined && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 走下方兜底 */
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.className = 'offscreen'
    document.body.append(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

function renderEmpty(t: Messages): HTMLElement {
  const box = el('section', 'card empty')
  box.append(el('h2', 'card-name', t.emptyTitle))
  box.append(el('p', 'card-desc', t.emptyBody))
  box.append(el('p', 'hint', t.emptyHint))
  return box
}

function renderError(t: Messages): HTMLElement {
  const box = el('section', 'card empty')
  box.append(el('h2', 'card-name', t.errorTitle))
  const retry = el('button', 'ghost', t.errorRetry)
  retry.type = 'button'
  retry.addEventListener('click', function () {
    void load()
  })
  box.append(retry)
  return box
}

function renderCard(t: Messages, entry: PluginEntry): HTMLLIElement {
  const item = el('li', 'card')

  const head = el('div', 'card-head')
  head.append(el('h2', 'card-name', entry.name))
  head.append(el('span', 'card-version', t.versionLabel + ' ' + entry.version))
  item.append(head)

  item.append(el('p', 'card-desc', entry.description))
  item.append(el('p', 'card-meta', t.authorLabel + ': ' + entry.author))

  const install = el('div', 'card-install')
  install.append(el('h3', 'card-subtitle', t.installTitle))
  const steps = el('ol', 'steps')
  for (const step of t.installSteps) {
    steps.append(el('li', undefined, step))
  }
  install.append(steps)

  const row = el('div', 'download')
  row.append(el('span', 'download-label', t.downloadLabel))
  row.append(el('code', 'download-url', entry.download))
  const copy = el('button', 'ghost small', t.copyAction)
  copy.type = 'button'
  row.append(copy)
  install.append(row)

  const hint = el('p', 'hint', '')
  hint.hidden = true
  install.append(hint)

  copy.addEventListener('click', function () {
    void handleCopy(t, entry.download, hint)
  })

  item.append(install)

  const link = el('a', 'card-link', t.homepageLabel)
  link.href = entry.homepage
  link.target = '_blank'
  link.rel = 'noreferrer noopener'
  item.append(link)

  return item
}

async function handleCopy(t: Messages, text: string, hint: HTMLParagraphElement): Promise<void> {
  const ok = await copyText(text)
  hint.textContent = ok ? t.copyDone : t.copyFail
  hint.classList.toggle('bad', !ok)
  hint.hidden = false
  window.setTimeout(function () {
    hint.hidden = true
  }, HINT_MS)
}

function renderList(t: Messages, list: PluginEntry[]): HTMLUListElement {
  const root = el('ul', 'list')
  for (const entry of list) {
    root.append(renderCard(t, entry))
  }
  return root
}

function render(): void {
  const t = messages[lang]
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  document.title = t.title

  mustGet('site-title').textContent = t.title
  mustGet('site-subtitle').textContent = t.subtitle
  mustGet('footer-note').textContent = t.footer

  const toggle = mustGet('lang-toggle')
  toggle.textContent = lang === 'zh' ? 'English' : '中文'
  toggle.setAttribute('aria-label', t.switchLabel)

  const content = mustGet('content')
  content.replaceChildren()

  if (failed) {
    content.append(renderError(t))
    return
  }
  if (entries === null) {
    content.append(el('p', 'hint', t.loading))
    return
  }
  if (entries.length === 0) {
    content.append(renderEmpty(t))
    return
  }
  content.append(renderList(t, entries))
}

async function load(): Promise<void> {
  const current = requestId + 1
  requestId = current
  failed = false
  entries = null
  render()

  try {
    const response = await fetch('./index.json', { cache: 'no-store' })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const payload: unknown = await response.json()
    const plugins = (payload as { plugins?: unknown } | null)?.plugins
    if (!Array.isArray(plugins)) throw new Error('索引结构不正确')
    if (current !== requestId) return
    entries = plugins.filter(isEntry)
  } catch {
    if (current !== requestId) return
    failed = true
  }
  render()
}

function start(): void {
  mustGet('lang-toggle').addEventListener('click', function () {
    lang = lang === 'zh' ? 'en' : 'zh'
    writeLang(lang)
    render()
  })
  void load()
}

start()
