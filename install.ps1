# ==============================================================================
# DeepSeek Harness Desktop - One-Line Installer for Windows
# https://github.com/miaoxiaoqian/deepseek-harness-desktop
# ==============================================================================

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  🐋 安装 DeepSeek Harness 桌面端 (Windows) " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未检测到 Node.js，请先前往 https://nodejs.org 安装 Node.js" -ForegroundColor Yellow
    exit 1
}

# 2. Check pnpm
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "📦 正在安装 pnpm..." -ForegroundColor Green
    npm install -g pnpm
}

# 3. Setup Directories
$InstallDir = "$env:APPDATA\deepseek-harness-desktop"
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
}
Set-Location $InstallDir

Write-Host "📥 正在获取最新 DeepSeek Harness 桌面端代码..." -ForegroundColor Green
if (Test-Path "$InstallDir\.git") {
    git pull origin main
} else {
    git clone --depth=1 https://github.com/miaoxiaoqian/deepseek-harness-desktop.git $InstallDir
}

# 4. Install & Run
Write-Host "⚙️ 正在安装依赖..." -ForegroundColor Green
pnpm install

Write-Host "🚀 正在启动 DeepSeek Harness 桌面端..." -ForegroundColor Cyan
npm start
