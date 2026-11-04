# 鲸鱼娘通话 · dsh-whale-call

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

