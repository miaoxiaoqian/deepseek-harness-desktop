# DeepSeek Harness Desktop (macOS & Windows)

<div align="center">
  <img src="assets/icon.png" width="128" height="128" alt="DeepSeek Harness Desktop Logo" />
  <h3>DeepSeek Harness 跨平台原生桌面端 (macOS / Windows / Linux)</h3>
  <p>100% 完整支持 Subagents、MCP 工具生态、LSP 代码智能与 Plan 模式的开箱即用桌面工作区</p>
</div>

---

## ⚡ 一键极速安装与启动（无需手动配置）

### 🍎 macOS / Linux (终端一键命令)
```bash
curl -fsSL https://raw.githubusercontent.com/miaoxiaoqian/deepseek-harness-desktop/main/install.sh | bash
```

### 🪟 Windows (PowerShell 一键命令)
```powershell
irm https://raw.githubusercontent.com/miaoxiaoqian/deepseek-harness-desktop/main/install.ps1 | iex
```

---

## ✨ 核心特性

- 🐋 **白底黑鲸官方视觉**：遵循 Apple 与 Windows Fluent 规范的原生质感图标与暗色毛玻璃（Vibrancy）沉浸式窗口；
- 🌐 **双平台开箱即用 (macOS & Windows)**：内置通用引擎引导器（Universal Engine Bootstrapper），任何人下载后自动连接或克隆官方最新引擎并运行；
- 🛡️ **红黄绿交通灯原生避让**：macOS 满屏无顶栏设计，左上角三色按钮自然融入，零遮挡；
- 🔄 **类 Codex 一键应用内热更新**：自动检测官方 GitHub 最新插件与代码提交，右下角弹窗一键无缝更新并重启，无需重新打包客户端；
- ⚡ **全局秒级唤起**：支持通过 <kbd>Option</kbd> + <kbd>Space</kbd>（Windows: <kbd>Alt</kbd> + <kbd>Space</kbd>）随时呼出与隐藏工作区；
- 📂 **原生工作区选择器**：支持 <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + <kbd>O</kbd> 随时通过系统原生文件管理器一键切换项目目录；
- 🧩 **100% 契合「一切皆插件」**：零侵入式 Cordis 微内核托管，49+ 个官方与第三方插件无损运行。

---

## 🛠️ 开发者手动编译

```bash
# 1. 克隆本仓库
git clone https://github.com/miaoxiaoqian/deepseek-harness-desktop.git
cd deepseek-harness-desktop

# 2. 安装依赖
npm install

# 3. 本地启动
npm start

# 4. 打包为分发安装包
npm run pack:dmg  # 打包 macOS (.dmg)
npm run pack:win  # 打包 Windows (.exe)
```

---

## 📄 License
MIT License. Based on DeepSeek Harness & Cordis.
