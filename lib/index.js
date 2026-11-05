/**
 * dsh-whale-call · 宿主半边
 *
 * 这个插件本身不带对话能力：它依赖 dsh-aurabot-qq（Aurabot）的 voice-lab 模块。
 * 但模块和小窗代码随本包一起发布，所以这里在启动时把它们"投放"到 Aurabot 的目录：
 *
 *   payload/module/index.mjs  →  <aurabot>/modules/voice-lab/index.mjs
 *   payload/app/*             →  <aurabot>/modules-data/voice-lab/app/*
 *
 * 规则：
 *   · 目标不存在 → 直接写
 *   · 目标存在但不是本版本写的（没有版本标记）→ 覆盖（用户没改过原版）
 *   · 已带本版本标记 → 跳过
 *   · 任何异常都只记日志，绝不抛（不能把 DSH 的启动搞挂）
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-whale-call'
export const inject = []

const MARK = '__whaleCallVersion'

function here() {
  return path.dirname(fileURLToPath(import.meta.url))
}

function pkgVersion() {
  try {
    const p = path.join(here(), '..', 'package.json')
    return JSON.parse(fs.readFileSync(p, 'utf8')).version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/** DSH_HOME：优先环境变量，其次常见布局。 */
function dshHome(ctx) {
  const env = String(process.env.DSH_HOME || '').trim()
  if (env && fs.existsSync(env)) return env
  try {
    const svc = ctx && (ctx.get ? ctx.get('homePaths') : null)
    const p = svc && (svc.home || svc.dshHome || (svc.paths && svc.paths.home))
    if (p && fs.existsSync(p)) return p
  } catch { /* 忽略 */ }
  const guesses = [
    path.join(process.env.APPDATA || '', 'Deepseek-Harness-Desktop', 'dsh-home'),
    path.join(os.homedir(), '.dsh'),
  ]
  return guesses.find((p) => p && fs.existsSync(p)) || ''
}

function aurabotDir(ctx) {
  const home = dshHome(ctx)
  if (!home) return ''
  const d = path.join(home, 'plugins-data', 'aurabot')
  return fs.existsSync(d) ? d : ''
}

function sameText(a, b) {
  try { return fs.readFileSync(a, 'utf8') === fs.readFileSync(b, 'utf8') } catch { return false }
}

function deploy(log, ctx) {
  const root = aurabotDir(ctx)
  if (!root) {
    log.warn('没找到 Aurabot 的插件数据目录；请先安装 dsh-aurabot-qq，再重启 DSH 让它自动投放')
    return { ok: false, reason: 'no-aurabot' }
  }

  const version = pkgVersion()
  const srcModule = path.join(here(), '..', 'payload', 'module', 'index.mjs')
  const srcApp = path.join(here(), '..', 'payload', 'app')

  // 1) 模块
  let moduleWritten = false
  try {
    const dst = path.join(root, 'modules', 'voice-lab', 'index.mjs')
    fs.mkdirSync(path.dirname(dst), { recursive: true })
    if (!sameText(srcModule, dst)) {
      fs.copyFileSync(srcModule, dst)
      moduleWritten = true
      log.info('voice-lab 模块已投放（v' + version + '）')
    }
  } catch (error) {
    log.warn('投放 voice-lab 模块失败：' + (error && error.message))
  }

  // 2) 小窗 app
  let appWritten = 0
  try {
    const dstDir = path.join(root, 'modules-data', 'voice-lab', 'app')
    fs.mkdirSync(dstDir, { recursive: true })
    // 递归拷贝（rooms/ 这类子目录必须一起投放，否则房间图片 404）
    const walk = (src, dst) => {
      fs.mkdirSync(dst, { recursive: true })
      for (const name of fs.readdirSync(src)) {
        const s = path.join(src, name)
        const d = path.join(dst, name)
        const st = fs.statSync(s)
        if (st.isDirectory()) { walk(s, d); continue }
        if (sameText(s, d)) continue
        fs.copyFileSync(s, d)
        appWritten++
      }
    }
    walk(srcApp, dstDir)
    if (appWritten) log.info('小窗程序已投放 ' + appWritten + ' 个文件（v' + version + '）')
  } catch (error) {
    log.warn('投放小窗失败：' + (error && error.message))
  }

  // 3) 版本标记（给客户端页面显示，也方便排查）
  try {
    const flag = path.join(root, 'modules-data', 'voice-lab', '.installed-by')
    fs.writeFileSync(flag, JSON.stringify({ pkg: 'dsh-whale-call', version, at: Date.now(), [MARK]: version }, null, 2), 'utf8')
  } catch { /* 忽略 */ }

  return { ok: true, version, moduleWritten, appWritten }
}

export function apply(ctx) {
  const log = (ctx && ctx.logger) || console
  try {
    const r = deploy(log, ctx)
    if (r && r.moduleWritten) {
      log.info('voice-lab 模块有新版本，DSH 会在下次加载模块时生效（也可在 Aurabot 面板点「重新加载模块」）')
    }
  } catch (error) {
    log.warn('dsh-whale-call 投放失败（不影响 DSH 启动）：' + (error && error.message))
  }
}
