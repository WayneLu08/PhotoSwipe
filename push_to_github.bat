@echo off
chcp 65001 >nul
echo ========================================================
echo        PhotoSwipe - GitHub 一键上传与云端打 APK 工具
echo ========================================================
echo.
echo 提示：请确保你已经在 GitHub (github.com) 新建了一个空仓库。
echo.
set /p REPO_URL=请输入你的 GitHub 仓库地址 (例如 https://github.com/username/photoswipe.git): 

if "%REPO_URL%"=="" (
    echo [错误] 仓库地址不能为空！
    pause
    exit /b
)

echo.
echo 正在关联远程仓库...
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main

echo.
echo 正在推送代码至 GitHub (请在弹出的窗口中登录你的 GitHub 账号)...
git push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo  🎉 恭喜！代码与介绍已成功推送到你的 GitHub 仓库！
    echo  GitHub Actions 正在云端免费为你全自动编译 Android APK！
    echo  可在仓库的 "Actions" 页面查看进度并下载 APK 安装包。
    echo ========================================================
) else (
    echo.
    echo [提示] 推送遇到问题，请检查网络或 GitHub 账号权限。
)

echo.
pause
