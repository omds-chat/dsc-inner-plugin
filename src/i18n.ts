export type Lang = 'zh' | 'en'

export interface Messages {
  title: string
  subtitle: string
  switchLabel: string
  loading: string
  emptyTitle: string
  emptyBody: string
  emptyHint: string
  errorTitle: string
  errorRetry: string
  installTitle: string
  installSteps: readonly string[]
  downloadLabel: string
  copyAction: string
  copyDone: string
  copyFail: string
  homepageLabel: string
  versionLabel: string
  authorLabel: string
  footer: string
}

export const messages: Record<Lang, Messages> = {
  zh: {
    title: 'dsc 同源插件',
    subtitle: 'omdsc-dev 组织自研插件索引,与社区合集 awesome-dsc-plugin 互为补充。',
    switchLabel: '切换到英文',
    loading: '正在读取索引。',
    emptyTitle: '暂无同源插件',
    emptyBody: 'omdsc-dev 组织尚未发布可安装的同源插件。',
    emptyHint: 'DeepSeek-Chat-Enhanced 的内置插件随产品分发,不出现在本索引中。新的同源插件发布后会出现在这里。',
    errorTitle: '索引读取失败',
    errorRetry: '重新读取',
    installTitle: '安装方法',
    installSteps: [
      '在 DeepSeek-Chat-Enhanced 的侧边栏打开插件面板。',
      '在面板底部的「从地址安装」输入框中粘贴下载地址。',
      '点击「安装」,插件随即自动启用。',
    ],
    downloadLabel: '下载地址',
    copyAction: '复制',
    copyDone: '已复制',
    copyFail: '复制失败,请手动选中地址后复制。',
    homepageLabel: '主页',
    versionLabel: '版本',
    authorLabel: '作者',
    footer: '本索引只收录 omdsc-dev 自研插件,这些插件不采集、不外传用户凭证与数据。',
  },
  en: {
    title: 'dsc In-House Plugins',
    subtitle: 'Index of plugins built by omdsc-dev, a companion to the community collection awesome-dsc-plugin.',
    switchLabel: 'Switch to Chinese',
    loading: 'Reading the index.',
    emptyTitle: 'No in-house plugins yet',
    emptyBody: 'omdsc-dev has not published any installable in-house plugin yet.',
    emptyHint: 'The plugins bundled with DeepSeek-Chat-Enhanced ship with the product and never appear in this index. New in-house plugins show up here once released.',
    errorTitle: 'Failed to read the index',
    errorRetry: 'Read again',
    installTitle: 'How to install',
    installSteps: [
      'Open the plugin panel from the DeepSeek-Chat-Enhanced sidebar.',
      'Paste the download URL into the "Install from URL" box at the bottom of the panel.',
      'Click Install, and the plugin activates right away.',
    ],
    downloadLabel: 'Download URL',
    copyAction: 'Copy',
    copyDone: 'Copied',
    copyFail: 'Copy failed, select the URL and copy it manually.',
    homepageLabel: 'Homepage',
    versionLabel: 'Version',
    authorLabel: 'Author',
    footer: 'This index only lists plugins built by omdsc-dev, which do not collect or leak user credentials and data.',
  },
}
