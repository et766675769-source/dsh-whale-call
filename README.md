# 鲸鱼娘通话 · dsh-whale-call

> 后续规划（元素坐标标注、角色走位、她自己切场景）见 [docs/ROADMAP.md](docs/ROADMAP.md)。

在 DSH 侧边栏加一个「鲸鱼娘通话」入口，点一下就在桌面上拉起一个小窗：

- 上半部分是鲸鱼娘的形象（复用桌宠的动画素材）
- **按住说话**（或按住空格）松开即发送；也可以点「🎙 检测说话」全自动听
- 识别 → 她回话 → 用她自己的声音念出来
- **对话不发到 QQ**，但人格、长期记忆、说话风格、相处经验都照常生效，也会沉淀成新的长期记忆

> 语音识别用 DSH 自带的语音输入（sensevoice，本地）；合成用 Aurabot 配置的 TTS（GPT-SoVITS / edge-tts 等）。

---

## 前置条件

| 依赖 | 说明 |
|---|---|
| **dsh-aurabot-qq** | 必需。本插件依赖它的 `voice-lab` 模块做对话后端（人格 / 记忆 / 会话注入） |
| DSH 语音输入 | 设置 → 插件里启用「语音输入」，模型下载完（`/aurabot/api/voice/asr-status` 显示 ready） |
| TTS | Aurabot 面板 → 语音里配置好引擎（GPT-SoVITS 需先在本地起 `api_v2.py`） |
| ffmpeg | 转码用。装好并加进 PATH，或在模块设置里填绝对路径 |
| Electron | 优先复用桌宠（dsh-pet）自带的那份；没有的话填 `electronPath` 或设环境变量 |

---

## 安装

### 方式一：插件市场（推荐）

本仓库自带一份符合 DSH 市场格式（format 1）的索引文件。把它的 URL 加进插件市场即可搜索安装。

**索引 URL：**

```
https://raw.githubusercontent.com/et766675769-source/dsh-whale-call/main/market/index.json
```

**添加步骤：**

1. 打开 DSH 的**插件市场**（侧栏的插件市场入口，或 设置 → 插件市场）
2. 进入**「发现」**页
3. 点右上角的菜单 → **「管理索引源…」**（页面空白时直接有「添加索引源」按钮）
4. 在**「索引 URL」**里粘贴上面那条地址，确认
5. 回到发现页，搜**「鲸鱼娘通话」**，点安装
6. **重启 DSH**（插件会在启动时把语音模块和小窗投放进 Aurabot 目录）

> 安装后的版本固定指向某个 commit，索引更新后需要重新安装才会升级。

### 方式二：从 GitHub 直装

不需要市场，也不需要有 npm 账号：

```bash
dsh plugin add git+https://github.com/et766675769-source/dsh-whale-call.git --profile web
```

也可以钉死版本：

```bash
dsh plugin add "git+https://github.com/et766675769-source/dsh-whale-call.git#ef932abc06d4a94a47067cb919cc97dce0cfa7f6" --profile web
```

### 方式三：npm

**暂未发布**（本项目先走 GitHub 分发）。等发布到 npm 后可用：

```bash
dsh plugin add dsh-whale-call --profile web
```

---

## 使用

1. 左侧栏点「鲸鱼娘通话」（麦克风图标）
2. 页面会自动把桌面小窗拉起来
3. 小窗里按住说话，或点「🎙 检测说话」
4. 说完停顿约 0.8 秒自动发送

小窗是无边框置顶的，可以拖到任意显示器，**位置会记住**；拽窗口边缘可以改大小。

### 小窗里的三个玩法（0.4.2）

**🍚 投喂** —— 左下角「投喂」按钮打开菜谱面板：

- 116 道菜，每张卡片显示 96px 缩略图 + 菜名；
- 顶部胶囊做分类筛选：`全部 / 大米饭 / 中餐 / 西餐 / 饮品·甜品`（带数量）；
- 点一道菜就发一轮 `（投喂）菜名` 给她，她按「被喂了什么」回应并出声；
- **投喂会写进长期记忆**：每次投喂后调用 Aurabot 的 `/aurabot/api/memory/add`，记下「老爹在语音小窗投喂了「菜名」」。所以她之后在 **QQ 那边聊天时也记得**这顿饭（记忆检索里能搜到）；记忆模块关着时自动跳过，不报错。
- 数据由主进程读本地文件（`whale-menu-all.json` + `output/thumbs/*.jpg`）后以 base64 交给页面，**不走网络、不走 file://**，所以面板里没有跨域/沙箱问题。

**🖼 换景通知** —— 点「换景」切换房间后，会自动把当前场景告诉她：

```
（换景）现在换到「蓝白·串灯」（id=v3-blue-detail，夜间）。
坐标均为百分比，[x,y,w,h]＝左上角与宽高，anchor＝[x,y] 锚点。
固定陈设：窗[10,6,36,42]；地毯[40,66,34,24]；台灯1[70,30,22,22]；…
可交互物：…（来自 rooms/anchors.js）
```

她因此知道自己在哪个房间、房间里的东西在哪，能接着聊「窗边」「地毯上」这类具体位置。

**🖐 形象可拖动** —— 按住角色拖到房间里别的位置：

- 拖动范围**限制在房间带内**（不会跑到日志区上方）；
- 左右/上下行程约 80px —— 由「角色 260px / 房间 340px」的尺寸决定，不是拖不动；
- 松手后位置写入 `localStorage`，下次开窗还在原处；
- 指针事件已阻断冒泡，拖形象不会误触「换景」。

**💗 心情状态条** —— 左下「待命」那一行现在是一条状态条：

```
待命  ▮▮▮▮▮▮▮▮▮▯  99
```

- 数据来自 Aurabot 的 `plugins-data/aurabot/mood.json`，主进程每 **3 秒**读一次；
- 填充宽度 = 心情值百分比，**颜色随区间变**：`<30 红` / `<60 橙` / `≥60 绿`；
- 状态切换时（待命 / 聆听中 / 说话中…）状态条始终跟着，不会丢；
- 读不到文件时只显示状态原文，不报错、不闪。

长按「换景」仍然进入坐标校准模式（0.4.1 的标注/微调功能不受影响）。

---

## 配置

模块设置（Aurabot 面板 → 模块 → 语音对话）：

| 项 | 默认 | 说明 |
|---|---|---|
| `enabled` | 开 | 总开关 |
| `timeoutSec` | 150 | 等她回复的超时 |
| `withVoice` | 开 | 回复同时合成语音 |
| `ffmpegPath` | 空 | 留空自动探测（设置 → 环境变量 → PATH → 常见位置） |
| `electronPath` | 空 | 留空自动探测（设置 → 环境变量 → 桌宠自带的） |

小窗里的说话检测灵敏度写在 `payload/app/index.html` 顶部：

```js
const ARM_RMS = 0.010      // 低阈值：先开录
const ONSET_RMS = 0.020    // 高阈值：确认在说话（调大更抗噪）
const HANGOVER_MS = 800    // 停多久算说完
```

---

## 常见问题

**点进去提示「语音后端没就绪」**
→ 没装 dsh-aurabot-qq，或装完没重启 DSH。先重启一次。

**有窗口但说话没反应**
→ 首次使用要允许麦克风；检查系统默认输入设备；说话检测阈值可以按环境调。

**提示找不到 ffmpeg**
→ 装 ffmpeg 并加进 PATH，或在模块设置里填 `ffmpegPath`。

**她的回复是文字不是语音**
→ 检查 Aurabot 的 TTS 引擎配置；GPT-SoVITS 需要 `127.0.0.1:9880` 在跑。

**识别总是吞掉第一个字**
→ 把 `ARM_RMS` 调小（更早开始录），或改用「按住说话」。

---

## 隐私

- 语音记录只在本地转码、本地识别（除非你配了云端 ASR）
- 对话写进 Aurabot 的 `chatlog`，用于夜间整理成长期记忆；不进 QQ
- 插件本身不联网，只有同源的 `127.0.0.1` 接口调用

---

## License

MIT

---

## 维护者：改完代码怎么发新版

### ⚠️ 改小窗代码的正确路径（很容易踩）

插件**每次启动都会用安装包里的 `payload/` 覆盖运行目录**（`lib/index.js` 里 `sameText` 不同就 `copyFileSync`）。所以：

| 只改了… | 重启后 |
|---|---|
| `modules-data/voice-lab/app/*`（运行目录） | ❌ 被安装包的旧 payload 盖回去 |
| `F:\Aurabot\dsh-whale-call\payload/*`（仓库） | ❌ 仓库变了，但装的是 npm 包，部署仍用旧 payload |
| **`node_modules/dsh-whale-call/payload/*`（安装包）** | ✅ 启动时原样投放，改动保留 |

正确顺序：

1. 改仓库 `F:\Aurabot\dsh-whale-call`
2. 同步进安装包：
   ```powershell
   $pkg  = "$env:DSH_HOME\profiles\web\node_modules\dsh-whale-call"
   $repo = "F:\Aurabot\dsh-whale-call"
   Copy-Item "$repo\payload\app\*" "$pkg\payload\app" -Recurse -Force
   Copy-Item "$repo\payload\module\index.mjs" "$pkg\payload\module\index.mjs" -Force
   ```
3. 投放 + 重启：`POST /aurabot/api/modules/reload`，再 `POST /aurabot/api/ext/voice-lab/window/stop` + `/window/start`
4. 升级版本、提交、推送

> 症状对照：分类/置顶按钮/心情条/房间布局「重启后消失」= 安装包 payload 是旧版，不是代码丢了。

1. 改代码，然后升 `package.json` 的 `version`（已发布的版本号不能重复用）
2. 提交并推送：

   ```bash
   git add -A
   git commit -m "feat: ..."
   git push origin main
   ```

3. 用新的 commit 重建索引：

   ```powershell
   $env:WHALE_SRC='git'
   $env:WHALE_GIT_URL='https://github.com/et766675769-source/dsh-whale-call'
   $env:WHALE_GIT_COMMIT=(git rev-parse HEAD)
   node market/build-index.mjs      # 会调用官方 parser 自检
   ```

4. 提交并推送 `market/index.json`：

   ```bash
   git add market/index.json
   git commit -m "chore: 更新市场索引到 <新版本>"
   git push origin main
   ```

> 索引里的 `source.commit` 决定别人装到哪个版本。**代码改了但索引没重建，别人装到的还是旧代码。**

### 索引格式的关键规则

生成时容易踩（都是官方 parser 硬校验的）：

| 字段 | 规则 |
|---|---|
| `format` | 必须是数字 `1` |
| 本地化文本的 key | **只能小写**：`zh` / `en`；写 `zh-CN` 会报 `must be keyed by a lowercase language id` |
| `publishTimestamp` | **Unix 秒**，不是毫秒 |
| `icon` | `data:image/(svg+xml\|png\|jpeg\|webp);base64,…`，解码后 ≤ 32 KiB；或相对索引 URL 的路径 |
| `metadata.category` | 必须先在 `metadata.categories` 里声明过 |
| `source.type` | `npm` 或 `git`；git 需要 40 位小写 commit SHA |

