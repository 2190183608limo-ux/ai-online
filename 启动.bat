@echo off
chcp 65001 >nul
echo ========================================
echo   AI 多平台对比系统 - 启动中...
echo ========================================
echo.

cd /d "%~dp0"

echo 正在检查依赖...
if not exist node_modules (
    echo 首次运行，正在安装依赖...
    npm install
)

echo.
echo 正在启动服务器...
echo 启动后会自动打开浏览器
echo 按 Ctrl+C 可以停止服务器
echo.

node server.js

pause
