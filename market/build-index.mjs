/**
 * 生成市场索引（format 1）。改完版本号跑一次：
 *
 *   node market/build-index.mjs
 *
 * 产物：market/index.json
 * 如果本机装了 DSH 的市场索引校验包，会自动用官方 parser 校验一遍。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const iconSvg = fs.readFileSync(path.join(root, 'assets', 'icon.svg'))
const icon = 'data:image/svg+xml;base64,' + iconSvg.toString('base64')

const index = {
  format: 1,
  title: { zh: '鲸鱼娘通话 · 插件索引', en: 'Whale Call plugin index' },
  description: {
    zh: '桌面语音小窗：按住说话就能和你的鲸鱼娘直接讲话。',
    en: 'A desktop voice window: hold to talk to your whale girl.',
  },
  metadata: {
    categories: {
      voice: { title: { zh: '语音与通话', en: 'Voice & calls' } },
      chat: { title: { zh: '聊天增强', en: 'Chat' } },
    },
    labels: {},
    sortKeys: {},
  },
  plugins: [
    {
      name: pkg.name,
      title: { zh: '鲸鱼娘通话', en: 'Whale Girl Call' },
      description: {
        zh: '在 DSH 侧边栏一键拉起桌面语音小窗：按住说话或自动检测说话，本地识别后交给她回话，再用她自己的声音念出来。对话不发 QQ，但人格、长期记忆、说话风格照常生效。依赖 dsh-aurabot-qq。',
        en: 'Launch a desktop voice window from the DSH sidebar. Push-to-talk or auto VAD, local speech recognition, reply in her own voice. Conversations stay out of QQ while persona, long-term memory and speaking style still apply. Requires dsh-aurabot-qq.',
      },
      icon,
      homepage: `https://www.npmjs.com/package/${pkg.name}`,
      metadata: {
        category: 'voice',
        keywords: ['voice', 'speech', 'tts', 'asr', 'desktop', 'aurabot', 'electron'],
      },
      versions: [
        {
          version: pkg.version,
          publishTimestamp: Math.floor(Date.now() / 1000),
          source: { type: 'npm' },
          engines: { dsh: '>=0.2.0-rc.1' },
        },
      ],
    },
  ],
}

const out = path.join(here, 'index.json')
fs.writeFileSync(out, JSON.stringify(index, null, 2) + '\n', 'utf8')
console.log('已生成 ' + out + '（' + (fs.statSync(out).size / 1024).toFixed(1) + ' KB）')

// 可选：用官方 parser 自检（找不到就跳过）
const candidates = [
  // 可用环境变量指定官方 parser 的位置
  process.env.DSH_MARKET_INDEX_PARSER || '',
  // 本机 DSH 安装目录里的那份
  'D:\\DS harkness\\Whale Isle\\resources\\vendor\\deepseek-harness\\node_modules\\@deepseek-ai\\dsh-plugin-market-index\\lib\\index.js',
  // profile 的 node_modules 里可能也有
  path.join(process.env.DSH_HOME || '', 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh-plugin-market-index', 'lib', 'index.js'),
].filter(Boolean)
for (const c of candidates) {
  if (!c || !fs.existsSync(c)) continue
  try {
    const mod = await import('file:///' + c.replace(/\\/g, '/'))
    const parsed = mod.parseMarketIndex(index, 'https://example.github.io/index.json')
    const p = parsed.plugins[0]
    console.log('官方校验通过：' + p.name + ' ' + p.versions.map((v) => v.version).join(', '))
    console.log('安装参数：' + JSON.stringify(mod.marketInstallTarget(p.name, p.versions[0])))
    break
  } catch (e) {
    console.log('校验失败：' + e.message)
  }
}
