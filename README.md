<div align="center">

# 📸 PhotoSwipe
### Swipe, Organize, Declutter — The Tinder for Your Photo Library
**像玩社交软件一样丝滑整理手机相册 · 上滑喜欢 · 下滑归档 · 左滑删除 · 右滑保留**

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20Web-blue?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/Framework-React%20Native%20%2B%20Expo-61dafb?style=flat-square" alt="Framework" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/Build-GitHub%20Actions%20APK-orange?style=flat-square" alt="Build" />
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square" alt="PRs" />
</p>

[English](#english) | [中文说明](#chinese)

</div>

---

<span id="chinese"></span>
## 💡 为什么需要 PhotoSwipe？

你手机里是不是也堆积了成千上万张照片？
- 随手拍的废片、屏幕截图、重复连拍，想删却懒得一张张点？
- 系统相册批量整理繁琐低效，经常误删或漏整理？

**PhotoSwipe** 将经典的 **Tinder 卡片堆叠滑动机制** 带入相册整理！把枯燥的照片清理变成一种像刷社交动态一样的**上头体验**，几分钟就能轻松给手机释放数十 GB 空间。

---

## ✨ 核心手势与交互体验

| 手势方向 | 对应操作 | 视觉反馈 | 体验说明 |
| :---: | :---: | :---: | :--- |
| **⬆ 上滑** | **❤️ 喜欢 / 收藏** | 绿色心形飞出 + 震动 | 迅速标记高光时刻，单独归入精选相册 |
| **⬇ 下滑** | **📁 收纳到相册** | 蓝色相册抽屉弹出 | 支持选择已有分类（旅行、生活、工作）或一秒新建相册 |
| **⬅ 左滑** | **🗑 快速删除** | 红色垃圾桶警示 | 扔进待清理队列，彻底告别模糊废片 |
| **➡ 右滑** | **✅ 保持原状** | 紫色勾号 | 觉得还可以的照片，保留在原相册继续留存 |
| **↩ 撤销** | **一键回退** | 卡片平滑飞回 | 误滑手抖？支持多步无损撤销上一次操作 |

---

## 🚀 核心技术与隐私亮点

- **🔒 100% 本地运行 · 绝对隐私安全**：照片处理全部在设备本地完成，无需上传任何云端服务器，照片隐私绝对安全。
- **⚡ 丝滑 60FPS 手势物理引擎**：采用 `Reanimated` 与原生物理手势绑定，支持阻尼回弹、旋转跟随与多级飞出动效。
- **📳 细腻触觉反馈**：不同手势方向配备专属震动波形（Haptic Feedback），指尖即刻感知操作。
- **🛡 防误删二次确认**：左滑删除进入缓冲保护池，支持随时复核或一键清理系统废纸篓。
- **📦 免本地环境出 APK**：内置 GitHub Actions 持续集成脚本，只需代码推送到仓库，云端免费服务器自动为你编译生成可直接安装的 `.apk` 安装包！

---

## 🛠 快速上手与运行

### 1. 立即体验 Web 交互版（免环境）
直接用浏览器打开项目中的 `index.html`，不仅支持鼠标拖拽，在手机浏览器中打开更支持真实触屏手势！支持导入真实本地照片，并可一键打包导出分类 ZIP。

### 2. 开发者本地运行 (React Native)
```bash
# 1. 安装依赖
npm install

# 2. 启动 Expo 开发服务
npx expo start
```
使用手机下载 **Expo Go** App 扫描终端二维码，即可在真机上秒级实时调试！

### 3. 一键编译 Android APK
项目内已配置 `.github/workflows/build-apk.yml`，两种方式获取 APK：
1. **GitHub 自动化（推荐）**：推送代码至你的 GitHub 仓库，在 **Actions** 标签页即可直接下载编译生成的 `PhotoSwipe-Release-APK`。
2. **Expo EAS 命令行**：
   ```bash
   npm install -g eas-cli
   eas build -p android --profile preview
   ```

---

<span id="english"></span>
## 🌟 English Overview

**PhotoSwipe** turns tedious photo cleaning into a delightful, game-like experience with intuitive 4-direction card swiping:
- **Swipe UP**: ❤️ Favorite
- **Swipe DOWN**: 📁 Organize into custom album
- **Swipe LEFT**: 🗑 Delete into trash bin
- **Swipe RIGHT**: ✅ Keep photo
- **Undo Button**: ↩ Smoothly rewind accidental swipes

100% offline, privacy-first, buttery smooth 60fps animations, and zero-setup cloud APK builds via GitHub Actions.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
欢迎 Star ⭐️ 与提交 PR！
