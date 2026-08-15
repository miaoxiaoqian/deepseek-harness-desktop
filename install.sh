#!/usr/bin/env bash
# ==============================================================================
# DeepSeek Harness Desktop - One-Line Installer for macOS & Linux
# https://github.com/miaoxiaoqian/deepseek-harness-desktop
# ==============================================================================

set -e

echo "========================================================"
echo "  🐋 安装 DeepSeek Harness 原生桌面端 (macOS / Linux) "
echo "========================================================"

# 1. Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 未检测到 Node.js，正在尝试通过 Homebrew 安装..."
  if command -v brew >/dev/null 2>&1; then
    brew install node pnpm
  else
    echo "请先前往 https://nodejs.org 安装 Node.js (推荐 v20+)"
    exit 1
  fi
fi

# 2. Check pnpm
if ! command -v pnpm >/dev/null 2>&1; then
  echo "📦 正在安装 pnpm 包管理器..."
  npm install -g pnpm
fi

# 3. Setup Directories
INSTALL_DIR="$HOME/.deepseek-harness-desktop"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo "📥 正在获取最新 DeepSeek Harness 桌面客户端..."
if [ -d "$INSTALL_DIR/.git" ]; then
  git pull origin main
else
  git clone --depth=1 https://github.com/miaoxiaoqian/deepseek-harness-desktop.git "$INSTALL_DIR"
fi

# 4. Install & Build
echo "⚙️ 正在安装客户端依赖..."
pnpm install

if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "🔨 正在编译 macOS 应用程序..."
  npm run build:mac
  cp -R dist/mac-arm64/DeepSeek\ Harness.app /Applications/ 2>/dev/null || cp -R dist/mac/DeepSeek\ Harness.app /Applications/
  xattr -cr "/Applications/DeepSeek Harness.app" 2>/dev/null || true
  
  echo ""
  echo "🎉 安装完成！DeepSeek Harness 已成功安装至 /Applications/DeepSeek Harness.app"
  echo "🚀 正在为您启动..."
  open "/Applications/DeepSeek Harness.app"
else
  echo "🎉 安装完成！在终端运行 'npm start' 即可启动客户端。"
  npm start
fi
