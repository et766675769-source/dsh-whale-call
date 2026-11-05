'use strict'
/**
 * Aurabot 语音小窗 — Electron 主进程
 *
 * - 320×420 无边框、置顶、半透明卡片
 * - 上半部分复用桌宠的 webm 素材（同一个 /asset 接口 + token）
 * - 按住说话：渲染进程录音(webm/opus) → 这里转发给 Aurabot 的 voice-lab 模块
 *   → 收到 { heard, reply, voice:{data} } 回给渲染进程播放
 *
 * 环境变量（由 Aurabot 的 voice-lab 模块启动时注入）：
 *   AURABOT_BASE   例如 http://127.0.0.1:3080
 *   PET_TOKEN      桌宠的 host-token（拉 /asset 素材用）
 *   PET_PACK       素材包名，默认 default
 */
const { app, BrowserWindow, ipcMain, session, screen } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const BASE = String(process.env.AURABOT_BASE || 'http://127.0.0.1:3080').replace(/\/+$/, '')
const TOKEN = String(process.env.PET_TOKEN || '')
const PACK = String(process.env.PET_PACK || 'default')

const W = 320
const H = 470
let win = null

// ---------- 窗口位置：记住上次位置，但越界（比如拔掉副屏）就回主屏 ----------
function boundsFile() {
  try { return path.join(app.getPath('userData'), 'window-bounds.json') } catch { return '' }
}

function onAnyDisplay(b) {
  if (!b || typeof b.x !== 'number' || typeof b.y !== 'number') return false
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea
    return b.x + (b.width || W) > a.x && b.x < a.x + a.width && b.y + (b.height || H) > a.y && b.y < a.y + a.height
  })
}

function loadBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(boundsFile(), 'utf8'))
    return onAnyDisplay(b) ? b : null
  } catch { return null }
}

function defaultBounds() {
  const a = screen.getPrimaryDisplay().workArea
  return { width: W, height: H, x: Math.round(a.x + a.width - W - 24), y: Math.round(a.y + 80) }
}

let saveTimer = null
function rememberBounds() {
  if (!win || win.isDestroyed()) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      const b = win.getBounds()
      if (onAnyDisplay(b)) fs.writeFileSync(boundsFile(), JSON.stringify(b), 'utf8')
    } catch { /* 忽略 */ }
  }, 400)
}

function createWindow() {
  const b = loadBounds() || defaultBounds()
  win = new BrowserWindow({
    width: b.width || W,
    height: b.height || H,
    x: b.x,
    y: b.y,
    minWidth: 260,
    minHeight: 420,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })
  win.setAlwaysOnTop(true, 'floating')
  win.loadFile(path.join(__dirname, 'index.html'))
  win.on('closed', () => { win = null })
  win.on('move', rememberBounds)
  win.on('resize', rememberBounds)
}

// 允许麦克风（Electron 默认会拒绝 getUserMedia）
function allowMic() {
  const ses = session.defaultSession
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media' || permission === 'audioCapture')
  })
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'media' || permission === 'audioCapture')
}

app.whenReady().then(() => {
  allowMic()
  createWindow()
})

app.on('window-all-closed', () => app.quit())

// ---------- IPC ----------

ipcMain.handle('info', () => ({ base: BASE, token: TOKEN, pack: PACK }))

/** 素材地址：和桌宠客户端拼法一致 */
ipcMain.handle('assetUrl', (_e, file) => (
  `${BASE}/aurabot/api/asset/${encodeURIComponent(PACK)}/${encodeURIComponent(file)}?token=${encodeURIComponent(TOKEN)}`
))

/** 一轮对话：{ audio?: base64, ext?: 'webm'|'wav', text?: string } */
ipcMain.handle('turn', async (_e, payload) => {
  const ctrl = AbortSignal.timeout(300000)
  try {
    const r = await fetch(`${BASE}/aurabot/api/ext/voice-lab/turn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload || {}),
      signal: ctrl,
    })
    const j = await r.json().catch(() => ({ ok: false, message: 'HTTP ' + r.status }))
    return j
  } catch (error) {
    return { ok: false, message: String((error && error.message) || error) }
  }
})

ipcMain.handle('status', async () => {
  try {
    const r = await fetch(`${BASE}/aurabot/api/ext/voice-lab/status`, { signal: AbortSignal.timeout(8000) })
    return await r.json()
  } catch (error) {
    return { ok: false, message: String((error && error.message) || error) }
  }
})

/** 动作清单（中文名 → anim-NNN） */
ipcMain.handle('animList', async () => {
  try {
    const r = await fetch(`${BASE}/aurabot/api/ext/voice-lab/anim/list`, { signal: AbortSignal.timeout(8000) })
    return await r.json()
  } catch (error) {
    return { ok: false, items: [], message: String((error && error.message) || error) }
  }
})

/** 手动指定一个动作（右键菜单用） */
ipcMain.handle('animSet', async (_e, name) => {
  try {
    const r = await fetch(`${BASE}/aurabot/api/ext/voice-lab/anim/set`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: String(name || '') }),
      signal: AbortSignal.timeout(8000),
    })
    return await r.json()
  } catch (error) {
    return { ok: false, message: String((error && error.message) || error) }
  }
})

/** 她选了动作没有（取一次就清空） */
ipcMain.handle('animPoll', async () => {
  try {
    const r = await fetch(`${BASE}/aurabot/api/ext/voice-lab/anim/poll`, { signal: AbortSignal.timeout(6000) })
    return await r.json()
  } catch {
    return { ok: true, anim: null }
  }
})

ipcMain.handle('win', (_e, action) => {
  if (!win || win.isDestroyed()) return false
  if (action === 'close') win.close()
  else if (action === 'min') win.minimize()
  else if (action === 'top') win.setAlwaysOnTop(!win.isAlwaysOnTop(), 'floating')
  return win.isAlwaysOnTop()
})

ipcMain.handle('bounds', () => (win && !win.isDestroyed() ? win.getBounds() : null))
