// 鲸鱼娘通话 · 网页半边
//
// 侧边栏入口（sidebar.panellist）+ 页面（main）。点进来会在挂载时自动把桌面小窗拉起来。
// 所有请求都打同源接口 /aurabot/api/ext/voice-lab/*，由 dsh-aurabot-qq 的 voice-lab 模块提供。

window.__ModuleLoader__.load({
  id: 'dsh-whale-call',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    const React = require('react')
    const { useState, useEffect, useRef, useCallback } = React
    const h = React.createElement

    const inject = ['slots']
    const PANEL_ID = 'whale-call'
    const API = '/aurabot/api/ext/voice-lab'
    const TITLE = '鲸鱼娘通话'

    /** 统一请求：区分「模块没装」（404/非 JSON）和真正的错误。 */
    async function call(path, method) {
      let r
      try {
        r = await fetch(API + path, {
          method: method || 'GET',
          headers: { 'content-type': 'application/json' },
          body: method === 'POST' ? '{}' : undefined,
        })
      } catch (e) {
        return { ok: false, missing: true, message: '连不上本地服务' }
      }
      if (r.status === 404) return { ok: false, missing: true, message: 'voice-lab 模块没有加载' }
      let j = null
      try { j = await r.json() } catch { j = null }
      if (!j) return { ok: false, message: 'HTTP ' + r.status }
      return j
    }

    function MicIcon() {
      return h('svg', {
        width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
      },
      h('rect', { x: 9, y: 2.5, width: 6, height: 11, rx: 3 }),
      h('path', { d: 'M5 11a7 7 0 0 0 14 0' }),
      h('line', { x1: 12, y1: 18, x2: 12, y2: 21.5 }),
      h('line', { x1: 8.5, y1: 21.5, x2: 15.5, y2: 21.5 }))
    }

    const wrap = { maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 4px' }
    const card = {
      border: '1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,.25))',
      borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
    }
    const btn = (primary, disabled) => ({
      padding: '8px 16px', borderRadius: 8, fontSize: 14,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      border: '1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,.35))',
      background: primary ? 'var(--dsw-alias-brand-primary, #4f8cff)' : 'transparent',
      color: primary ? '#fff' : 'inherit',
    })
    const muted = { opacity: 0.7, fontSize: 13, lineHeight: 1.7 }
    const small = { opacity: 0.65, fontSize: 12.5, lineHeight: 1.7 }

    function Dot(props) {
      const color = props.state === 'ok' ? '#2ecc71' : props.state === 'warn' ? '#f1c40f' : '#999'
      return h('span', {
        style: { width: 9, height: 9, borderRadius: 999, display: 'inline-block', background: color },
      })
    }

    function Guide() {
      return h('div', { style: { ...card, borderColor: 'rgba(241,196,15,.6)' } },
        h('div', { style: { fontWeight: 600 } }, '还差一步：语音后端没就绪'),
        h('div', { style: muted },
          '这个插件依赖 Aurabot 的 voice-lab 模块。请检查：'),
        h('ol', { style: { ...muted, paddingLeft: 20, margin: 0 } },
          h('li', null, '已安装 dsh-aurabot-qq 插件并启用（设置 → 插件）'),
          h('li', null, '重启一次 DSH —— 本插件会在启动时把模块和小窗投放进 Aurabot 目录'),
          h('li', null, 'Aurabot 面板 → 模块 → 确认「语音对话 voice-lab」在运行')),
        h('div', { style: small }, '投放目标：<DSH_HOME>/plugins-data/aurabot/modules/voice-lab/'))
    }

    function VoiceLabPage() {
      const [st, setSt] = useState(null)
      const [busy, setBusy] = useState(false)
      const [msg, setMsg] = useState('')
      const [missing, setMissing] = useState(false)
      const autoTried = useRef(false)

      const refresh = useCallback(async () => {
        const s = await call('/window/status')
        if (s && s.missing) { setMissing(true); setSt(null); return }
        setMissing(false)
        setSt(s)
      }, [])

      const start = useCallback(async () => {
        setBusy(true)
        try {
          const r = await call('/window/start', 'POST')
          if (r && r.missing) { setMissing(true); setMsg('') } else if (r && r.ok) {
            setMsg(r.already ? '小窗本来就在跑' : '已启动小窗（pid ' + r.pid + '）')
          } else setMsg('启动失败：' + ((r && r.message) || '未知原因'))
        } finally {
          setBusy(false)
          refresh()
        }
      }, [refresh])

      const stop = useCallback(async () => {
        setBusy(true)
        try {
          const r = await call('/window/stop', 'POST')
          setMsg(r && r.ok ? (r.message || '已关闭') : '关闭失败：' + ((r && r.message) || '未知原因'))
        } finally {
          setBusy(false)
          refresh()
        }
      }, [refresh])

      useEffect(() => {
        refresh()
        const t = setInterval(refresh, 4000)
        return () => clearInterval(t)
      }, [refresh])

      useEffect(() => {
        if (autoTried.current) return
        autoTried.current = true
        start()
      }, [start])

      const running = Boolean(st && st.running)
      const ready = Boolean(st && st.electron && st.app)

      return h('div', { style: wrap },
        h('div', { style: { fontSize: 20, fontWeight: 600 } }, TITLE),
        h('div', { style: muted },
          '桌面小窗：上半部分是她，按住说话（或按住空格）就能直接讲；也能点「检测说话」全自动听。',
          h('br'),
          '对话不发到 QQ，但人格、长期记忆、说话风格都照常生效，也会沉淀成新的记忆。'),

        missing ? h(Guide) : null,

        !missing && h('div', { style: card },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 } },
            h(Dot, { state: running ? 'ok' : 'warn' }),
            h('span', null, running ? '小窗运行中' : '小窗未运行')),
          h('div', { style: small },
            'Electron：' + (st ? (st.electron ? '就绪' : '缺失') : '…')
            + ' · 后端：' + (st && st.ok ? '就绪' : '未就绪')
            + (st && st.ffmpeg === false ? ' · ffmpeg：没找到' : '')
            + (st && st.pid ? ' · pid ' + st.pid : '')),
          h('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 } },
            h('button', { style: btn(true, busy || !ready), disabled: busy || !ready, onClick: start },
              running ? '重新拉起 / 聚焦' : '启动小窗'),
            h('button', { style: btn(false, busy || !running), disabled: busy || !running, onClick: stop }, '关闭小窗'),
            h('button', { style: btn(false, busy), disabled: busy, onClick: refresh }, '刷新状态')),
          st && st.ffmpeg === false
            ? h('div', { style: { ...small, color: '#e67e22' } },
                '没找到 ffmpeg：装一个并加进 PATH，或在 Aurabot → 模块 → voice-lab 设置里填绝对路径。')
            : null,
          msg ? h('div', { style: small }, msg) : null),

        !missing && h('div', { style: small },
          '小窗是无边框置顶的，可以拖到任意显示器（位置会记住）。'
          + '首次使用需要允许麦克风；说话检测的灵敏度可以在小窗里按住说话对比后再调。'))
    }

    function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined) return
      try {
        slots.inject('main', () => slots.register({ name: 'main', key: PANEL_ID }, VoiceLabPage))
        slots.inject('sidebar.panellist', () => slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 21,
          label: () => TITLE,
        }, MicIcon))
      } catch (error) {
        if (typeof console !== 'undefined') console.warn('[whale-call] 注册失败', error)
      }
    }

    exports.apply = apply
    exports.inject = inject
    exports.VoiceLabPage = VoiceLabPage
    exports.MicIcon = MicIcon
    return module.exports
  },
})
