import fs from 'node:fs'
/**
 * 等距房间背景生成器 v2
 * 坐标：iso(x, y, z)。x 往右下方延展，y 往左下方延展，z 向上。
 *   · x=0 平面 → 屏幕左边的墙（左墙）
 *   · y=0 平面 → 屏幕右边的墙（右墙，大窗在这面）
 *   · x+y 越大越靠近观众
 */
const W = 680
const H = 1200
const F = 8            // 房间边长（格）
const K = 48           // 每格像素（整房入镜，同时填满画面）
const OX = 340          // 原点（后墙角）屏幕居中
const OY = 520
const WALL_H = 3.6

const iso = (x, y, z = 0) => [OX + (x - y) * K, OY + (x + y) * K * 0.5 - z * K]
const P = (pts) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
const poly = (pts, fill, extra = '') => `<polygon points="${P(pts)}" fill="${fill}" ${extra}/>`

const SHADE = (c, top, left, right) => ({ top, left, right })

function box(x, y, z, w, d, h, c) {
  const p = iso
  const top = poly([p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)], c.top)
  // 朝观众的两个面：y+d 面（偏左）、x+w 面（偏右）
  const left = poly([p(x, y + d, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x, y + d, z + h)], c.left)
  const right = poly([p(x + w, y, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x + w, y, z + h)], c.right)
  return top + left + right
}

const C = {
  skyTop: '#060b18', skyBottom: '#0e1830',
  floor: '#22304d', floorLine: '#2c3d60',
  wallA: '#18233a',   // 左墙
  wallB: '#141d30',   // 右墙
  trim: '#28374f',
  bedBase: '#4f5f7d', bedMat: '#cad8f2', bedMatSide: '#a8bcdd',
  duvet: '#33507f', duvetTop: '#42679d',
  wood: { top: '#584639', left: '#443529', right: '#31261e' },
  shelf: { top: '#4a3a2e', left: '#3a2d23', right: '#2a211a' },
  deskTop: { top: '#5a719b', left: '#41546f', right: '#2f3d52' },
  metal: { top: '#44567a', left: '#33415c', right: '#252f45' },
  chair: { top: '#4fc4d8', left: '#3a9fb2', right: '#2c8091' },
  rug: '#1b4a66', rugIn: '#276f8c',
  warm: '#ffcf8a', moon: '#e9f2ff',
}

const out = []
const add = (s) => out.push(s)

// ---------- 背景 ----------
add(`<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.skyTop}"/><stop offset="1" stop-color="${C.skyBottom}"/>
  </linearGradient>
  <radialGradient id="lamp" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#ffd79a" stop-opacity="0.42"/>
    <stop offset="1" stop-color="#ffd79a" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#dce9ff" stop-opacity="0.5"/>
    <stop offset="1" stop-color="#dce9ff" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#bcd6ff" stop-opacity="0.16"/>
    <stop offset="1" stop-color="#bcd6ff" stop-opacity="0"/>
  </linearGradient>
</defs>`)
add(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`)
// 星
let seed = 20261
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
for (let i = 0; i < 70; i++) {
  const x = rnd() * W, y = rnd() * 360, r = rnd() * 1.3 + 0.3
  add(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#cfe0ff" opacity="${(rnd() * 0.45 + 0.12).toFixed(2)}"/>`)
}

// ---------- 地面 ----------
add(poly([iso(0, 0), iso(F, 0), iso(F, F), iso(0, F)], C.floor))
for (let i = 1; i < F; i++) {
  const a = iso(i, 0), b = iso(i, F)
  add(`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${C.floorLine}" stroke-width="1" opacity="0.45"/>`)
  const c = iso(0, i), d = iso(F, i)
  add(`<line x1="${c[0].toFixed(1)}" y1="${c[1].toFixed(1)}" x2="${d[0].toFixed(1)}" y2="${d[1].toFixed(1)}" stroke="${C.floorLine}" stroke-width="1" opacity="0.45"/>`)
}

// ---------- 两面墙 ----------
add(poly([iso(0, 0, WALL_H), iso(F, 0, WALL_H), iso(F, 0, 0), iso(0, 0, 0)], C.wallB)) // 右墙（y=0）
add(poly([iso(0, 0, WALL_H), iso(0, F, WALL_H), iso(0, F, 0), iso(0, 0, 0)], C.wallA)) // 左墙（x=0）
add(poly([iso(0, 0, WALL_H), iso(F, 0, WALL_H), iso(F, 0, WALL_H - 0.14), iso(0, 0, WALL_H - 0.14)], C.trim))
add(poly([iso(0, 0, WALL_H), iso(0, F, WALL_H), iso(0, F, WALL_H - 0.14), iso(0, 0, WALL_H - 0.14)], C.trim))

// ---------- 右墙：大窗 + 月亮 ----------
{
  const x0 = 0.85, x1 = 6.1, z0 = 0.92, z1 = 3.22
  const q = [iso(x0, 0, z1), iso(x1, 0, z1), iso(x1, 0, z0), iso(x0, 0, z0)]
  add(poly(q, '#08101f', 'stroke="#39507a" stroke-width="4"'))
  // 月亮（窗内偏右）
  const mc = iso(x0 + (x1 - x0) * 0.74, 0, (z0 + z1) / 2 + 0.34)
  add(`<circle cx="${mc[0].toFixed(1)}" cy="${mc[1].toFixed(1)}" r="58" fill="url(#moonGlow)"/>`)
  add(`<circle cx="${mc[0].toFixed(1)}" cy="${mc[1].toFixed(1)}" r="15" fill="${C.moon}"/>`)
  // 窗格（十字）
  const mx = (x0 + x1) / 2
  const vTop = iso(mx, 0, z1), vBot = iso(mx, 0, z0)
  add(`<line x1="${vTop[0].toFixed(1)}" y1="${vTop[1].toFixed(1)}" x2="${vBot[0].toFixed(1)}" y2="${vBot[1].toFixed(1)}" stroke="#39507a" stroke-width="3"/>`)
  const mz = (z0 + z1) / 2
  const hL = iso(x0, 0, mz), hR = iso(x1, 0, mz)
  add(`<line x1="${hL[0].toFixed(1)}" y1="${hL[1].toFixed(1)}" x2="${hR[0].toFixed(1)}" y2="${hR[1].toFixed(1)}" stroke="#39507a" stroke-width="3"/>`)

  // 雪的裁剪区域 = 窗口四边形
  add(`<clipPath id="winClip"><polygon points="${P([iso(x0, 0, z1), iso(x1, 0, z1), iso(x1, 0, z0), iso(x0, 0, z0)])}"/></clipPath>`)
  // 雪花（默认隐藏，加 .fx-snow 才显示）
  {
    const fl = []
    const bx0 = Math.min(iso(x0, 0, z0)[0], iso(x0, 0, z1)[0])
    const bx1 = Math.max(iso(x1, 0, z0)[0], iso(x1, 0, z1)[0])
    const by0 = Math.min(iso(x0, 0, z1)[1], iso(x1, 0, z1)[1])
    const by1 = Math.max(iso(x0, 0, z0)[1], iso(x1, 0, z0)[1])
    let rs = 777
    const rr = () => ((rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    for (let i = 0; i < 42; i++) {
      const fx = bx0 + rr() * (bx1 - bx0)
      const fy = by0 + rr() * (by1 - by0)
      const r = 2.0 + rr() * 2.2
      const dur = 3.5 + rr() * 3.5
      const delay = -rr() * 6
      fl.push(`<circle class="flake" cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="${r.toFixed(1)}" fill="#eaf4ff" opacity="0.96" style="animation-duration:${dur.toFixed(1)}s;animation-delay:${delay.toFixed(1)}s"/>`)
    }
    add(`<g id="snowLayer" clip-path="url(#winClip)">${fl.join('')}</g>`)
  }
  // 月光落地
  add(poly([iso(x0 + 0.2, 0, z0), iso(x1 - 0.2, 0, z0), iso(x1 - 0.6, 2.6, 0), iso(x0 + 0.6, 2.6, 0)], 'url(#beam)'))
}

// ---------- 左墙：挂画 ----------
{
  const a0 = 1.05, a1 = 2.35, z0 = 1.95, z1 = 2.75
  add(poly([iso(0, a0, z1), iso(0, a1, z1), iso(0, a1, z0), iso(0, a0, z0)], '#1e3050', 'stroke="#3b5480" stroke-width="4"'))
  const c = iso(0, (a0 + a1) / 2, (z0 + z1) / 2)
  add(`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="7" fill="#cfe0ff" opacity="0.65"/>`)
}


// ---------- 左墙挂钟 ----------
{
  const cy0 = 3.55, cz = 2.5
  const c = iso(0, cy0, cz)
  const rot = -26.57   // 左墙面（x=0）在屏幕上的倾斜角
  const rx = K * 0.44, ry = K * 0.44 * 0.42
  add(`<g transform="rotate(${rot} ${c[0].toFixed(1)} ${c[1].toFixed(1)})">`)
  add(`<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#24334f" stroke="#44608f" stroke-width="3"/>`)
  add(`<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(rx * 0.8).toFixed(1)}" ry="${(ry * 0.8).toFixed(1)}" fill="#0d1728"/>`)
  add(`<line x1="${c[0].toFixed(1)}" y1="${c[1].toFixed(1)}" x2="${c[0].toFixed(1)}" y2="${(c[1] - ry * 0.62).toFixed(1)}" stroke="#b9cdea" stroke-width="2.2"/>`)
  add(`<line x1="${c[0].toFixed(1)}" y1="${c[1].toFixed(1)}" x2="${(c[0] + rx * 0.5).toFixed(1)}" y2="${c[1].toFixed(1)}" stroke="#b9cdea" stroke-width="1.8"/>`)
  add('</g>')
}

// ---------- 地毯（房间中央偏前） ----------
{
  const c = iso(4.3, 4.4, 0.01)
  add(`<ellipse id="rugBase" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(K * 1.55).toFixed(1)}" ry="${(K * 0.78).toFixed(1)}" fill="${C.rug}" opacity="0.95"/>`)
  add(`<ellipse id="rugRing" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="${(K * 1.1).toFixed(1)}" ry="${(K * 0.55).toFixed(1)}" fill="${C.rugIn}" opacity="0.9" stroke="#7fd8ef" stroke-width="2" stroke-dasharray="10 14"/>`)
  add(`<path d="M ${(c[0] - 22).toFixed(1)} ${(c[1] + 3).toFixed(1)} q 22 -17 22 5 q 0 -22 22 -5 q -5 17 -22 12 q -17 5 -22 -12 z" fill="#cfe8f5" opacity="0.5"/>`)
}

// ---------- 床（靠左墙，长边沿 y 方向） ----------
{
  const x = 0.05, y = 0.75, w = 1.8, d = 2.85
  add(box(x, y, 0, w, d, 0.42, SHADE(0, C.bedBase, '#43516c', '#333f56')))            // 床架
  add(box(x + 0.06, y + 0.06, 0.42, w - 0.12, d - 0.12, 0.22, SHADE(0, C.bedMat, C.bedMatSide, '#8fa4c6'))) // 床垫
  add(box(x + 0.06, y + 1.5, 0.64, w - 0.12, d - 1.56, 0.12, SHADE(0, C.duvetTop, C.duvet, '#27406b')))    // 被子
  add(box(x + 0.22, y + 0.22, 0.64, w - 0.44, 0.72, 0.16, SHADE(0, '#eef4ff', '#d5e0f4', '#bac9e4')))      // 枕头
  add(box(x, y - 0.12, 0, 0.12, d + 0.24, 1.0, SHADE(0, '#5b6a86', '#485570', '#394457')))                 // 床头板
}


// ---------- 床头柜 + 床头灯 ----------
{
  const x = 1.98, y = 0.42, w = 0.8, d = 0.72
  add(box(x, y, 0, w, d, 0.62, { top: '#4a3a2e', left: '#3a2d23', right: '#2a211a' }))
  // 抽屉缝 + 把手
  const a = iso(x, y + d, 0.34), b = iso(x + w, y + d, 0.34)
  add(`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#241b14" stroke-width="2"/>`)
  add(box(x + 0.3, y + d - 0.06, 0.36, 0.24, 0.04, 0.05, { top: '#9a8a6e', left: '#7a6a4e', right: '#5e5138' }))
  // 台灯：灯杆 + 灯罩 + 暖光
  add(box(x + 0.3, y + 0.25, 0.62, 0.12, 0.12, 0.34, { top: '#3a4a66', left: '#2d3a52', right: '#232d40' }))
  const lc = iso(x + 0.36, y + 0.31, 1.0)
  add(`<ellipse id="bedGlow" cx="${lc[0].toFixed(1)}" cy="${lc[1].toFixed(1)}" rx="68" ry="46" fill="url(#lamp)"/>`)
  add(`<path d="M ${(lc[0] - 13).toFixed(1)} ${lc[1].toFixed(1)} l 26 0 l 7 14 l -40 0 z" fill="#ffd79a" opacity="0.92"/>`)
  add(`<circle cx="${lc[0].toFixed(1)}" cy="${(lc[1] + 8).toFixed(1)}" r="4" fill="#fff2d0"/>`)
}

// ---------- 书架（左墙靠后，开口朝观众） ----------
{
  const x = 0.15, y = 3.75, w = 1.0, d = 1.7, h = 2.0
  // 侧板 + 顶板 + 背板（用三个立方体拼出敞开感）
  add(box(x, y, 0, 0.1, d, h, C.shelf))                 // 靠墙侧板
  add(box(x + w - 0.1, y, 0, 0.1, d, h, C.shelf))       // 外侧板
  add(box(x, y, h - 0.1, w, d, 0.1, C.shelf))           // 顶板
  add(box(x, y + d - 0.08, 0, w, 0.08, h, C.shelf))     // 背板
  // 隔板 + 书
  const colors = ['#7a4a4a', '#3f6b8a', '#6b7a3f', '#8a6b3f', '#4a5f8a']
  for (let i = 0; i <= 2; i++) {
    const z = 0.15 + i * 0.7
    add(box(x + 0.1, y, z, w - 0.2, d - 0.1, 0.06, C.shelf))
    for (let b = 0; b < 3; b++) {
      add(box(x + 0.16 + b * 0.26, y + 0.25 + (i % 2) * 0.2, z + 0.06, 0.16, 0.18, 0.44,
        SHADE(0, colors[(i + b) % 5], '#00000022', '#00000044')))
    }
  }
}

// ---------- 书桌（右墙窗下） ----------
{
  const x = 2.95, y = 0.26, w = 2.7, d = 1.05, top = 0.92
  add(box(x, y, top, w, d, 0.1, C.deskTop))
  for (const [lx, ly] of [[x + 0.07, y + 0.07], [x + w - 0.14, y + 0.07], [x + 0.07, y + d - 0.14], [x + w - 0.14, y + d - 0.14]]) {
    add(box(lx, ly, 0, 0.07, 0.07, top, C.metal))
  }
  // 桌面前沿高光
  add(poly([iso(x, y + d, top + 0.1), iso(x + w, y + d, top + 0.1), iso(x + w, y + d, top + 0.02), iso(x, y + d, top + 0.02)], '#7d97c4', 'opacity="0.55"'))

  // 电饭煲（桌面左端）
  {
    const cx0 = x + 0.12, cy0 = y + 0.28, cw = 0.62, cd = 0.56, ch = 0.34, base = top + 0.1
    add(box(cx0, cy0, base, cw, cd, ch, { top: '#e6edf7', left: '#c7d3e4', right: '#a9b8cf' }))
    add(box(cx0 + 0.02, cy0 + 0.02, base + ch, cw - 0.04, cd - 0.04, 0.1, { top: '#f4f8ff', left: '#d6dfee', right: '#b8c6dc' }))
    const knob = iso(cx0 + cw / 2, cy0 + cd / 2, base + ch + 0.16)
    add(`<ellipse cx="${knob[0].toFixed(1)}" cy="${knob[1].toFixed(1)}" rx="7" ry="4" fill="#8fa4c6"/>`)
    // 指示灯
    const lampDot = iso(cx0 + cw - 0.08, cy0 + cd - 0.1, base + ch - 0.06)
    add(`<circle cx="${lampDot[0].toFixed(1)}" cy="${lampDot[1].toFixed(1)}" r="3" fill="#ff9f68"/>`)
  }
  // 显示器
  add(box(x + 1.15, y + 0.32, top + 0.1, 1.05, 0.08, 0.62, SHADE(0, '#0f1623', '#0b111b', '#080d15')))
  add(box(x + 1.57, y + 0.38, top + 0.1, 0.18, 0.04, 0.26, SHADE(0, '#161e2c', '#111825', '#0d131d')))
  const sc = iso(x + 1.67, y + 0.34, top + 0.45)
  add(`<ellipse cx="${sc[0].toFixed(1)}" cy="${sc[1].toFixed(1)}" rx="34" ry="24" fill="#8fc0ff" opacity="0.26"/>`)
  // 屏幕本体（发光面）
  add(poly([iso(x + 1.17, y + 0.3, top + 0.68), iso(x + 2.17, y + 0.3, top + 0.68), iso(x + 2.17, y + 0.3, top + 0.14), iso(x + 1.17, y + 0.3, top + 0.14)], '#2f6ea8', 'opacity="0.9"'))
  // 台灯
  add(box(x + 2.42, y + 0.26, top + 0.1, 0.14, 0.14, 0.5, C.metal))
  const lc = iso(x + 2.49, y + 0.33, top + 0.66)
  add(`<ellipse id="lampGlow" cx="${lc[0].toFixed(1)}" cy="${lc[1].toFixed(1)}" rx="96" ry="62" fill="url(#lamp)"/>`)
  add(`<circle cx="${lc[0].toFixed(1)}" cy="${lc[1].toFixed(1)}" r="7" fill="${C.warm}"/>`)
  // 椅子（桌前）
  add(box(x + 1.05, y + 1.18, 0, 0.8, 0.8, 0.36, C.chair))
  add(box(x + 1.05, y + 1.18, 0.36, 0.8, 0.8, 0.06, SHADE(0, '#5fd3e3', '#46aec0', '#3393a5')))
  add(box(x + 1.1, y + 1.89, 0.42, 0.7, 0.1, 0.58, C.chair))
}



// ---------- 懒人沙发（前景右侧） ----------
{
  const b = iso(6.3, 2.7, 0)
  add(`<ellipse cx="${b[0].toFixed(1)}" cy="${(b[1] + 6).toFixed(1)}" rx="${(K * 0.95).toFixed(1)}" ry="${(K * 0.42).toFixed(1)}" fill="#1b2739" opacity="0.55"/>`)
  add(`<ellipse cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" rx="${(K * 0.9).toFixed(1)}" ry="${(K * 0.7).toFixed(1)}" fill="#2f6f8f"/>`)
  add(`<ellipse cx="${(b[0] - 4).toFixed(1)}" cy="${(b[1] - 10).toFixed(1)}" rx="${(K * 0.82).toFixed(1)}" ry="${(K * 0.6).toFixed(1)}" fill="#3d8aa8"/>`)
  add(`<ellipse cx="${(b[0] - 6).toFixed(1)}" cy="${(b[1] - 16).toFixed(1)}" rx="${(K * 0.66).toFixed(1)}" ry="${(K * 0.46).toFixed(1)}" fill="#4ba3c2"/>`)
  // 抱枕
  add(`<ellipse cx="${(b[0] + 12).toFixed(1)}" cy="${(b[1] - 20).toFixed(1)}" rx="${(K * 0.3).toFixed(1)}" ry="${(K * 0.22).toFixed(1)}" fill="#e0ebff" opacity="0.9"/>`)
}

// ---------- 墙角植物（靠后墙角） ----------
{
  const x = 0.35, y = 6.35
  add(box(x, y, 0, 0.45, 0.45, 0.36, SHADE(0, '#6a5546', '#523f34', '#3d2e26')))
  const c = iso(x + 0.2, y + 0.2, 0.55)
  add(`<path d="M ${c[0].toFixed(1)} ${c[1].toFixed(1)} q -20 -30 2 -50 q 18 20 -2 50 z" fill="#2f6b4a" opacity="0.95"/>`)
  add(`<path d="M ${c[0].toFixed(1)} ${c[1].toFixed(1)} q 22 -26 4 -44 q -18 16 -4 44 z" fill="#3d8a5f" opacity="0.9"/>`)
}

const body = out.join('\n')
// 完整版（整窗背景用）
process.stdout.write(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
${body}
</svg>
`)
// 舞台裁切版：只取房间本体（去掉大块星空和前景空地板）
const stagePath = process.env.ROOM_STAGE_OUT
if (stagePath) {
  const VB = { x: 0, y: 250, w: 680, h: 760 }
  fs.writeFileSync(stagePath, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" width="${VB.w}" height="${VB.h}">
${body}
</svg>
`, 'utf8')
}
