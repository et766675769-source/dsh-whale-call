/**
 * voice-lab：桌面语音小窗的后端。
 *
 * 链路：小窗按住说话 → webm/opus → 这里用 ffmpeg 转 16k 单声道 wav
 *        → DSH 语音识别（sensevoice）→ 文字
 *        → 塞进一个「伪私聊」会话跑一轮（人格/规则/记忆/工具全都走原路径）
 *        → 拦下回复（不让它发到 QQ）→ 合成语音 → 回给小窗播放
 *
 * 为什么用 pseudo chat 而不是 runSystemTurn：
 *   runSystemTurn 走的是 system 会话，而记忆模块对 system 会话**故意不加**上下文
 *   （见 modules/memory/index.js：chat.kind === 'system' ? '' : contextFor(...)）。
 *   用 kind='private' 的伪会话，人格 + 记忆 + 情绪全都照常生效。
 *
 * 为什么不发 QQ：注册 'reply' 过滤器，命中本会话时把文本捕获走并 return null，
 *   hub.deliver() 见到 null 就直接拦下（"扩展模块拦下了这次回复"），不会走发送。
 */
import fs from 'node:fs'
import { join } from 'node:path'
import { spawn, execFileSync } from 'node:child_process'

// 伪会话：chatId 必须和真私聊区分开（否则 reply 过滤器会把 QQ 回复也拦掉），
// 但 userId 必须是主人 QQ —— memory.contextFor() 用 chat.userId 决定
// 读谁的「小档案 / 相处经验 / 说话风格」（personKey = qq:<userId>）。
const VOICE_CHAT_ID = 'private:voice-lab'

// ffmpeg 探测顺序：模块设置 → 环境变量 → PATH → 常见安装位置。
// 发布版不能写死任何人的机器路径，换台机器要能自己找到。
const FFMPEG_ENV = ["AURABOT_FFMPEG", "DSH_FFMPEG", "FFMPEG_PATH"]
const FFMPEG_GUESSES = [
  "C:\\ffmpeg\\bin\\ffmpeg.exe",
  "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
]

export default {
  id: 'voice-lab',
  name: '鲸鱼娘通话',
  version: '0.1.0',
  api: 1,
  description: '桌面语音小窗的后端：语音转文字 → 她回话 → 合成语音（说话记录不发到 QQ）',
  defaults: { enabled: true, timeoutSec: 150, withVoice: true },
  settings: [
    { key: 'enabled', label: '开启语音对话', type: 'switch' },
    { key: 'timeoutSec', label: '等她回复的超时(秒)', type: 'number', min: 30, max: 600, step: 10 },
    { key: 'withVoice', label: '回复同时合成语音', type: 'switch' },
  ],

  setup(api) {
    const log = api.log
    const state = { lastUser: '', lastReply: '', lastAt: 0, turns: 0, errors: 0, busy: false, lastError: '' }
    let pending = null

    const cfg = () => { try { return { ...api.settings() } } catch { return {} } }

    let ffCache = { at: 0, p: "" }
    const ffmpegPath = () => {
      if (ffCache.p && Date.now() - ffCache.at < 60000) return ffCache.p
      try {
        const custom = String(cfg().ffmpegPath || '').trim()
        if (custom && fs.existsSync(custom)) return custom
      } catch { /* 忽略 */ }
      for (const k of FFMPEG_ENV) {
        const v = String(process.env[k] || '').trim()
        if (v && fs.existsSync(v)) return v
      }
      // PATH 里的 ffmpeg（Windows 用 where，其它平台用 which）
      try {
        const r = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['ffmpeg'], { encoding: 'utf8', timeout: 4000, windowsHide: true })
        const first = String(r || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0]
        if (first && fs.existsSync(first)) return first
      } catch { /* 没有就继续猜 */ }
      for (const p of FFMPEG_GUESSES) { try { if (fs.existsSync(p)) return p } catch { /* 忽略 */ } }
      return ''
    }
    const ffmpegCached = () => {
      const v = ffmpegPath()
      if (v) ffCache = { at: Date.now(), p: v }
      return v
    }

    /** 跑一段外部命令，收集 stdout/stderr。 */
    function run(cmd, args, timeoutMs = 60000) {
      return new Promise((resolve) => {
        let out = ''
        let err = ''
        let done = false
        const finish = (code) => { if (done) return; done = true; resolve({ code, out, err }) }
        let child
        try { child = spawn(cmd, args, { windowsHide: true }) } catch (e) { return finish(-1) }
        const timer = setTimeout(() => { try { child.kill() } catch { /* 忽略 */ } finish(-2) }, timeoutMs)
        child.stdout?.on('data', (d) => { out += String(d) })
        child.stderr?.on('data', (d) => { err += String(d) })
        child.on('error', () => { clearTimeout(timer); finish(-1) })
        child.on('close', (code) => { clearTimeout(timer); finish(code) })
      })
    }

    /** 任意音频 → 16k 单声道 wav 的字节。 */
    async function toWav16k(inputPath, outPath) {
      const ff = ffmpegCached()
      if (!ff) throw new Error('找不到 ffmpeg')
      // bitexact：不写 LIST/encoder 元数据。DSH 的 WAV 解析器很严，
      // ffmpeg 默认会在 fmt 后插入 LIST 块，它就直接报 "Invalid speech WAV"。
      const base = ['-y', '-hide_banner', '-loglevel', 'error']
      const tryArgs = (extra) => [...base, ...extra, '-i', inputPath,
        '-map_metadata', '-1', '-flags:a', '+bitexact',
        '-ar', '16000', '-ac', '1', '-f', 'wav', outPath]
      let r = await run(ff, tryArgs(['-fflags', '+bitexact']), 120000)
      if (r.code !== 0) {
        // 录音偶尔会给出时间戳断裂/截断的 webm（比如浏览器切块时被打断）。
        // 放宽解码：补时间戳、容忍坏帧，再试一次。
        r = await run(ff, tryArgs(['-fflags', '+genpts+discardcorrupt', '-err_detect', 'ignore_err']), 120000)
      }
      if (r.code !== 0 || !fs.existsSync(outPath)) throw new Error('音频转换失败：' + String(r.err || '').slice(0, 200))
      let buf = fs.readFileSync(outPath)
      // 再用插件自己的 wav 工具规范化一遍（双保险；拿不到就算了）
      try {
        const wav = api.lib?.('voice/wav.js')
        if (wav && typeof wav.toMono16k === 'function') buf = Buffer.from(wav.toMono16k(buf))
      } catch { /* 忽略 */ }
      return buf
    }

    /** 语音识别：返回听到的文字。 */
    async function transcribe(wavBuf) {
      const stt = api.dsh?.get?.('speechToText')
      if (!stt || typeof stt.resolve !== 'function' || typeof stt.transcribe !== 'function') {
        throw new Error('DSH 里没有可用的语音识别（插件「语音输入」没开）')
      }
      const snap = typeof stt.snapshot === 'function' ? stt.snapshot() : null
      if (snap && snap.phase && snap.phase !== 'ready') throw new Error('语音识别模型没就绪：' + snap.phase)
      const spec = stt.resolve({ audio: new Uint8Array(wavBuf) })
      const r = await stt.transcribe(spec, AbortSignal.timeout(120000))
      const text = typeof r === 'string' ? r : (r && (r.text || r.transcript))
      return text ? String(text).trim() : ''
    }

    /** 这个伪会话的 chat 描述：userId 用主人 QQ，记忆才认得「对方」是谁。 */
    function chatOf() {
      const owner = String(api.config?.()?.ownerQQ || '')
      const name = String(api.config?.()?.ownerName || '老爹')
      return { chatId: VOICE_CHAT_ID, kind: 'private', userId: owner || 'owner', nickname: name }
    }

    /** 把这一问一答写进聊天日志（整理器只认 chatlog，不写就永远沉淀不成记忆）。 */
    function logToChatlog(userText, replyText) {
      try {
        const owner = String(api.config?.()?.ownerQQ || '')
        const name = String(api.config?.()?.ownerName || '老爹')
        const dir = join(api.dataDir(), '..', '..', 'chatlog')
        fs.mkdirSync(dir, { recursive: true })
        const d = new Date()
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        // chatId 记成真私聊：夜间整理器按 chatId 抽取记忆，这样才会归到老爹名下
        const chatId = owner ? `private:${owner}` : VOICE_CHAT_ID
        const rows = []
        if (userText) rows.push({ t: Date.now(), chatId, who: name, uid: owner || '', text: String(userText) })
        if (replyText) rows.push({ t: Date.now() + 1, chatId, who: 'bot', text: String(replyText) })
        if (!rows.length) return
        fs.appendFileSync(join(dir, day + '.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
      } catch (error) {
        log.debug('[voice-lab] 写聊天日志失败：' + String(error?.message || error))
      }
    }

    /** 把一句话交给她，等她这一轮说完，返回正文（不发 QQ）。 */
    async function ask(text) {
      const hub = api.core?.hub
      if (!hub || typeof hub.pushToSession !== 'function') throw new Error('拿不到聊天中枢 hub')
      if (pending) throw new Error('上一句还没回完')
      const chat = chatOf()
      const owner = chat.userId
      const limit = Math.max(30000, (Number(cfg().timeoutSec) || 150) * 1000)
      const wait = new Promise((resolve, reject) => {
        const timer = setTimeout(() => { if (pending && pending.timer === timer) pending = null; reject(new Error('等她的回复超时')) }, limit)
        pending = { resolve, reject, timer }
      })
      try {
        // content 必须是内容块数组（hub.admit() 会做 content.length / content.filter）
        // queryText 给「相关记忆检索」用，不给的话召回就退化成只看当前文案
        await hub.pushToSession(chat, [{ type: 'text', text: String(text) }], owner, { queryText: String(text) })
      } catch (error) {
        if (pending) { clearTimeout(pending.timer); pending = null }
        throw error
      }
      return wait
    }

    /** 合成语音，返回 wav 字节。 */
    async function speak(text) {
      if (cfg().withVoice === false) return null
      try {
        const v = api.use?.('voice')
        if (!v || typeof v.speak !== 'function') return null
        const r = await v.speak(String(text))
        if (!r || !r.file) return null
        return { engine: r.engine, data: fs.readFileSync(r.file) }
      } catch (error) {
        log.warn('[voice-lab] 合成失败：' + String(error?.message || error))
        return null
      }
    }

    /** 把回复里的 <voice>/<sticker:xx>/<reply:n>/图片 标记清成纯文本。
     *  不清的话：小窗会显示 "<voice>…</voice>" 字面量，TTS 还会把 "voice" 念出来。 */
    function cleanReply(raw) {
      const t = String(raw || '').trim()
      try {
        const rp = api.lib?.('chat/reply.js')
        if (rp && typeof rp.parseReply === 'function') {
          const r = rp.parseReply(t)
          const items = r && Array.isArray(r.items) ? r.items : []
          if (items.length) {
            const parts = items.map((it) => {
              if (it.kind === 'text') return it.value
              if (it.kind === 'voice') return it.value          // 语音的实际台词，文字保留
              if (it.kind === 'sticker') return '[' + it.value + ']'
              if (it.kind === 'image') return '[图片]'
              return ''
            }).filter(Boolean)
            if (parts.length) return parts.join('\n')
          }
        }
      } catch { /* 拿不到就回退到正则 */ }
      return t
        .replace(/<voice>([\s\S]*?)<\/voice>/g, '$1')
        .replace(/<\/?sticker[^>]*>/g, '')
        .replace(/<reply:\s*\d+\s*>/g, '')
        .replace(/<poke\s*\/?>/g, '')
        .trim()
    }

    // ---------- 拦截她对这个伪会话的回复 ----------
    try {
      api.on('reply', (text, info) => {
        if (!info || info.chatId !== VOICE_CHAT_ID) return undefined
        const t = cleanReply(text)
        if (t) {
          state.lastReply = t
          state.lastAt = Date.now()
          state.turns += 1
        }
        if (pending) {
          const p = pending
          pending = null
          try { clearTimeout(p.timer) } catch { /* 忽略 */ }
          p.resolve(t)
        }
        return null // 拦下：不发 QQ
      })
    } catch (error) {
      log.debug('[voice-lab] 挂 reply 过滤器失败：' + String(error?.message || error))
    }

    // ---------- 小窗（Electron）----------
    // 复用桌宠已经装好的 Electron，省一份 240MB。
    // pid 存文件：模块热重载会把内存里的 winPid 冲掉，之前就因此泄漏出一个管不到的旧窗口
    // （两个窗口叠在一起、按钮出现重影）。
    let winPid = 0
    const appDir = (() => { try { return api.dataDir('app') } catch { return '' } })()
    const pidFile = (() => { try { return api.dataDir('window.pid') } catch { return '' } })()
    /** Electron 可执行文件：设置 → 环境变量 → 桌宠自带的 → 常见安装位置。 */
    function electronExe() {
      try {
        const custom = String(cfg().electronPath || '').trim()
        if (custom && fs.existsSync(custom)) return custom
      } catch { /* 忽略 */ }
      const envs = ['AURABOT_ELECTRON', 'DSH_ELECTRON', 'ELECTRON_PATH']
      for (const k of envs) {
        const v = String(process.env[k] || '').trim()
        if (v && fs.existsSync(v)) return v
      }
      const guesses = []
      try { guesses.push(join(api.dataDir(), '..', 'pet', 'app', 'node_modules', 'electron', 'dist', 'electron.exe')) } catch { /* 忽略 */ }
      guesses.push('C:\\Program Files\\Electron\\electron.exe')
      for (const g of guesses) { try { if (fs.existsSync(g)) return g } catch { /* 忽略 */ } }
      return ''
    }
    const petToken = () => {
      try { return fs.readFileSync(join(api.dataDir(), '..', 'pet', 'host-token'), 'utf8').trim() } catch { return '' }
    }

    const alive = (pid) => {
      if (!pid) return false
      try { process.kill(pid, 0); return true } catch { return false }
    }
    /** 启动时把上次记下的 pid 捞回来（热重载不丢窗口所有权）。 */
    function loadPid() {
      try {
        const n = Number(fs.readFileSync(pidFile, 'utf8').trim()) || 0
        if (n && alive(n)) winPid = n
      } catch { /* 没有就算了 */ }
    }
    function savePid(pid) {
      try { fs.writeFileSync(pidFile, String(pid || 0), 'utf8') } catch { /* 忽略 */ }
    }
    function winAlive() { return alive(winPid) }

    /** 找到当前 DSH 端口（挨个试探 voice-lab/status）。 */
    async function findBase() {
      const seen = new Set()
      const env = /:(\d+)(?:\/|$)/.exec(process.env.DSH_WEB_URL || '')
      const cands = [env && Number(env[1]), 3080, 8583, 11564, 4474].filter((p) => p && !seen.has(p) && seen.add(p))
      for (const p of cands) {
        try {
          const r = await fetch(`http://127.0.0.1:${p}/aurabot/api/ext/voice-lab/status`, { signal: AbortSignal.timeout(2500) })
          if (r.ok) return `http://127.0.0.1:${p}`
        } catch { /* 下一个 */ }
      }
      return ''
    }

    async function startWindow() {
      loadPid() // 热重载后先把上次的窗口认回来
      if (winAlive()) return { ok: true, already: true, pid: winPid, message: '小窗已经在跑了' }
      if (!fs.existsSync(electronExe())) return { ok: false, message: '找不到 Electron：' + (electronExe() || '（未配置）') }
      if (!fs.existsSync(join(appDir, 'main.js'))) return { ok: false, message: '小窗程序缺失：' + appDir }
      const base = await findBase()
      if (!base) return { ok: false, message: '找不到 Aurabot 的本地端口' }
      try {
        const child = spawn(electronExe(), [appDir], {
          cwd: appDir,
          detached: true,
          stdio: 'ignore',
          windowsHide: false,
          env: { ...process.env, AURABOT_BASE: base, PET_TOKEN: petToken(), PET_PACK: 'default' },
        })
        child.unref()
        winPid = child.pid || 0
        savePid(winPid)
        log.info('[voice-lab] 小窗已启动 pid ' + winPid)
        return { ok: true, pid: winPid, message: '小窗已启动', base }
      } catch (error) {
        return { ok: false, message: '启动失败：' + String(error?.message || error) }
      }
    }

    function stopWindow() {
      loadPid()
      if (!winAlive()) { savePid(0); return { ok: true, message: '小窗没在跑' } }
      const pid = winPid
      try { process.kill(pid) } catch { /* 忽略 */ }
      winPid = 0
      savePid(0)
      return { ok: true, message: '已关闭小窗（pid ' + pid + '）' }
    }

    // ---------- 接口 ----------
    try {
      api.route('/window/start', async () => startWindow())
      api.route('/window/stop', async () => stopWindow())
      api.route('/window/status', async () => {
        loadPid() // 热重载后内存里是 0，先把 pid 文件里的窗口认回来，否则会误报「没在跑」
        return {
          ok: true,
          running: winAlive(),
          pid: winPid,
          electron: fs.existsSync(electronExe()),
          app: fs.existsSync(join(appDir, 'main.js')),
          base: await findBase(),
        }
      })
    } catch (error) {
      log.debug('[voice-lab] 挂窗口接口失败：' + String(error?.message || error))
    }

    try {
      api.route('/status', async () => ({
        ok: true,
        ...state,
        chatId: VOICE_CHAT_ID,
        ffmpeg: Boolean(ffmpegCached()),
        pending: Boolean(pending),
      }))

      // 一轮对话：{ audio: base64, ext } 或 { text }
      api.route('/turn', async (req) => {
        if (cfg().enabled === false) return { ok: false, message: '语音对话关着' }
        if (state.busy) return { ok: false, message: '还在处理上一句' }
        state.busy = true
        const t0 = Date.now()
        try {
          const body = await readJson(req)
          let heard = String(body.text || '').trim()
          let audioIn = null
          if (!heard) {
            const b64 = String(body.audio || '')
            if (!b64) return { ok: false, message: '没有音频也没有文字' }
            const ext = String(body.ext || 'webm').replace(/[^a-z0-9]/gi, '') || 'webm'
            const tmp = api.dataDir('voice-in.' + ext)
            const wavTmp = api.dataDir('voice-16k.wav')
            fs.writeFileSync(tmp, Buffer.from(b64, 'base64'))
            const wav = await toWav16k(tmp, wavTmp)
            audioIn = wav.length
            heard = await transcribe(wav)
            try { fs.unlinkSync(tmp) } catch { /* 忽略 */ }
            if (!heard) return { ok: false, message: '没听清，再说一次？' }
          }
          state.lastUser = heard
          const reply = await ask(heard)
          logToChatlog(heard, reply)   // 写进聊天日志，夜间整理器才会把它变成长期记忆
          const voice = await speak(reply)
          return {
            ok: true,
            heard,
            reply,
            audioBytes: audioIn,
            voice: voice ? { engine: voice.engine, mime: 'audio/wav', data: voice.data.toString('base64') } : null,
            ms: Date.now() - t0,
          }
        } catch (error) {
          state.errors += 1
          state.lastError = String(error?.message || error)
          log.warn('[voice-lab] 一轮失败：' + state.lastError)
          return { ok: false, message: state.lastError }
        } finally {
          state.busy = false
        }
      })
    } catch (error) {
      log.debug('[voice-lab] 挂路由失败：' + String(error?.message || error))
    }

    /** 读 JSON 请求体（模块 api 没给现成的就自己读）。 */
    async function readJson(req) {
      try {
        const h = api.core?.http
        if (h && typeof h.body === 'function') return await h.body(req).catch(() => ({}))
      } catch { /* 忽略 */ }
      return await new Promise((resolve) => {
        let raw = ''
        try {
          req.on('data', (c) => { raw += c })
          req.on('end', () => { try { resolve(JSON.parse(raw || '{}')) } catch { resolve({}) } })
          req.on('error', () => resolve({}))
        } catch { resolve({}) }
      })
    }

    log.debug('[voice-lab] 就绪：' + VOICE_CHAT_ID)
    return { ask, speak, transcribe, status: () => ({ ...state }) }
  },
}
