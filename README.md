# DeepSeek Harness Desktop (macOS & Windows)

<div align="center">
  <img src="assets/icon.png" width="128" height="128" alt="DeepSeek Harness Desktop Logo" />
  <h3>DeepSeek Harness 跨平台原生桌面端 (Windows & macOS & Linux)</h3>
  <p>100% 完整支持 Subagents、MCP 工具生态、LSP 代码智能与 Plan 模式的开箱即用桌面工作区</p>
  <p><strong>🌐 Win & Mac 跨平台完全复用 · 纯净开源 · 零隐私数据 · 无内置密钥 · 即拉即用</strong></p>
</div>

---

## ⚡ 极速安装与启动（双平台通用 · 无需下载压缩包）

本桌面端源码直接推送到 GitHub 仓库，**任何人无需下载大型压缩包或 DMG**，通过一条命令或 `git clone` 即可在 Windows 和 Mac 上直接启动并复用完整桌面应用！

### 🪟 Windows 用户（PowerShell 一键命令）
打开 PowerShell 运行：
```powershell
irm https://raw.githubusercontent.com/miaoxiaoqian/deepseek-harness-desktop/main/install.ps1 | iex
```

### 🍎 macOS / Linux 用户（终端一键命令）
打开终端运行：
```bash
curl -fsSL https://raw.githubusercontent.com/miaoxiaoqian/deepseek-harness-desktop/main/install.sh | bash
```

---

## 🛠️ 跨平台通用手动克隆与运行 (Git Clone & Run)

无论在 Windows 还是 macOS，只要安装了 [Node.js](https://nodejs.org/) (推荐 v20+)，均可直接拉取本仓库运行：

```bash
# 1. 克隆本桌面端仓库
git clone https://github.com/miaoxiaoqian/deepseek-harness-desktop.git
cd deepseek-harness-desktop

# 2. 安装桌面端依赖
npm install

# 3. 启动桌面端 (Windows / Mac 均通用)
npm start
```

> [!NOTE]
> 首次启动时，内置的通用引擎引导器（Universal Engine Supervisor）会自动检测本机环境。若本机尚未安装 DeepSeek Harness 核心，将自动在用户私有数据目录中完成官方核心环境配置，并无缝打开原生桌面窗口。

---

## 🛡️ 隐私与数据安全保证 (Zero Privacy Leaks)

本仓库与桌面客户端严格遵循开源隐私与零泄露标准：
- ❌ **绝无任何个人 API Key**：不含任何预设密钥、Token 或云端凭据；首次使用时由用户在设置中输入自己的 DeepSeek API Key；
- ❌ **绝无个人照片与私有素材**：代码中不包含任何个人相册、相片、历史项目或私人文件；
- ❌ **数据 100% 本地存储**：所有会话记录、模型交互与项目工作区均保留在用户本机的标准数据目录中，绝不上传到任何第三方服务；
- ❌ **无任何开发者绝对路径绑定**：全量代码均自适应检测当前操作系统和用户的主目录（`os.homedir()` / `%APPDATA%`），绝不硬编码任何个人电脑路径。

---

## ✨ 跨平台核心特性

- 🐋 **深色/浅色自适应官方质感视觉**：
  - macOS：支持黑鲸白底 / 白鲸黑底自适应 Dock 图标，沉浸式毛玻璃窗口，无缝红黄绿交通灯避让；
  - Windows：遵循 Fluent 规范的原生窗口与系统托盘，优雅的暗黑界面体验；
- 🌐 **双平台开箱即用 (macOS & Windows)**：内置跨平台进程守护与自启动机制，无论在 Mac 还是 Windows 均可一键启动；
- ⚡ **全局秒级唤起**：
  - macOS：按下 <kbd>Option</kbd> + <kbd>Space</kbd> 随时呼出与隐藏工作区；
  - Windows：按下 <kbd>Alt</kbd> + <kbd>Space</kbd> 随时呼出与隐藏工作区；
- 📂 **原生文件管理器选区**：随时通过快捷键 <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>O</kbd> 调用系统原生文件选择器切换项目工作区；
- 🧩 **100% 完整支持官方生态**：Subagents 多代理协作、MCP 工具链、Plan 模式无损运行。

---

## 📦 可选：本地打包为独立安装文件（若需要发给无 Node.js 用户）

如果需要为没有配置 Node.js 环境的普通用户制作可独立执行的安装程序，可以在本仓库中直接打包：

```bash
# macOS: 打包为 DMG 磁盘镜像
npm run pack:dmg

# Windows: 打包为 NSIS 安装引导程序 (.exe)
npm run pack:win
```

---

## 📄 License
MIT License. Based on DeepSeek Harness & Electron.
