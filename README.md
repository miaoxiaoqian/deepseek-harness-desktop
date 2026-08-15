# DeepSeek Harness Desktop (macOS Native App)

<div align="center">
  <img src="assets/icon.png" width="128" height="128" alt="DeepSeek Harness Desktop Logo" />
  <h3>DeepSeek Harness 官方原生 macOS 桌面端</h3>
  <p>100% 完整支持 Subagents、MCP 工具生态、LSP 代码智能与 Plan 模式的开箱即用桌面工作区</p>
</div>

---

## ✨ 核心特性

- 🐋 **白底黑鲸官方视觉**：遵循 Apple 规范的 macOS 原生 Squircle 质感图标与暗色毛玻璃（Vibrancy）沉浸式窗口；
- 🛡️ **红黄绿交通灯原生避让**：全局 34px 安全带，彻底消除系统按钮与 DeepSeek 标识的重叠问题；
- 🔄 **类 Codex 一键应用内热更新**：自动检测官方 GitHub 最新插件与代码提交，右下角弹窗一键无缝更新并重启，无需重新打包客户端；
- ⚡ **全局秒级唤起**：支持通过 <kbd>Option</kbd> + <kbd>Space</kbd> 随时呼出与隐藏工作区；
- 📂 **Finder 原生工作区选择**：支持 <kbd>Cmd</kbd> + <kbd>O</kbd> 随时通过 macOS 访达一键切换项目目录；
- 🧩 **100% 契合「一切皆插件」**：零侵入式 Cordis 微内核托管，49+ 个官方与第三方插件无损运行。

---

## 🚀 快速上手

### 1. 安装依赖与启动开发模式
```bash
git clone git@github.com:miaoxiaoqian/deepseek-harness-desktop.git
cd deepseek-harness-desktop
npm install
npm start
```

### 2. 打包为 macOS 独立安装包 (.dmg / .app)
```bash
npm run build:mac   # 生成原生 .app 应用程序
npm run pack:dmg    # 生成独立 .dmg 安装镜像
```

---

## 🛠️ 项目架构

```
deepseek-harness-desktop/
├── assets/                  # 官方矢量白底黑鲸图标与菜单栏托盘资产
│   ├── icon.icns            # macOS 多尺寸图标
│   ├── icon.png             # 1024x1024 高清图标
│   └── tray.png             # 菜单栏常驻状态图标
├── src/
│   ├── main.cjs             # 主进程：生命周期、进程监督、一键热更新通道
│   ├── preload.cjs          # 安全 IPC 桥接
│   ├── desktop-theme.css    # 原生样式优化、毛玻璃覆盖层、热更新组件
│   └── splash.html          # 启动过渡动态加载屏
└── package.json
```

---

## 📄 License
MIT License. Based on DeepSeek Harness & Cordis.
