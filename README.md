<div align="center">

# 🍃 PhotoSwipe · 轻相册
### Swipe, Organize, Declutter — 让相册轻一点，再轻一点
**像刷动态一样丝滑整理相册 · 时间胶囊按月整理 · 待删回收箱一键清空 · 屏幕截图/大视频专区**

<p align="center">
  <img src="https://img.shields.io/badge/Version-v2.1.0-emerald?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20Web-blue?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/Framework-React%20Native%20%2B%20Expo-61dafb?style=flat-square" alt="Framework" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/Build-GitHub%20Actions%20APK-orange?style=flat-square" alt="Build" />
</p>

[下载最新 APK (v2.1.0)](#-安装包下载) | [中文说明](#chinese) | [English](#english)

</div>

---

<span id="chinese"></span>
## 💡 为什么需要 PhotoSwipe · 轻相册？

面对手机里积攒的成千上万张相片、过期的屏幕截图、随手拍下的模糊废片，你是否也觉得系统相册整理起来费时费力？
- **左划一次弹窗一次？太烦人！** PhotoSwipe v2.0.0 引入**待删回收箱机制**，滑动时只暂存，整理完毕后一次性彻底批量抹除，不频繁打断手感！
- **上万张照片无从下手？** 引入**时间胶囊（按月整理）**，按年、月分组攻坚，整理完一个月自动打卡完成，成就感爆棚！
- **想快速清理无用截图和大视频？** 提供**截图专区**与**视频瘦身**专项筛选通道，一键抓出占用存储空间的元凶。

---

## ✨ 核心手势与交互

| 手势方向 | 对应动作 | 系统联动机制 | 交互特色 |
| :---: | :---: | :--- | :--- |
| **⬆ 上滑** | **❤️ 喜欢 / 收藏** | 物理加入系统专属相册「PhotoSwipe-精选喜欢」 | 自动创建或定位相册，支持跨卷复制兜底 |
| **⬇ 下滑** | **📁 收纳到相册** | 真实归档至系统既有相册或一键新建相册 | 弹出收纳抽屉，支持快速新建自定义分类 |
| **⬅ 左滑** | **🗑 移入待删箱** | 暂存至待删回收箱（不弹窗打断手感） | 顶部待删箱常驻角标，可随时复核并一键永久释放 |
| **➡ 右滑** | **✨ 保留相册** | 原相册留存 | 标记保留，直接推进至下一张 |
| **↩ 撤销** | **一键回退 (Undo)** | 平滑飞回卡片顶部，撤回对应操作 | 误滑手抖？支持无损回退历史动作 |

---

## 🚀 v2.0.0 核心功能全景

1. **时间胶囊 · 按月整理**：
   - 自动提取拍摄时间，按 `YYYY年M月`（如 `2026年9月`、`2026年8月`）聚合成独立卡片堆。
   - 包含月份完成进度条与通关结算卡片，轻松告别“相册整理焦虑”。
2. **待删回收箱 · 一次性批量清理**：
   - 划走删除时无感暂存，避免频繁弹窗授权。
   - 待删箱支持缩略图网格预览、单张恢复、预估节省空间（MB/GB 统计）。
   - 点击“一键彻底释放”，底层仅触发一次系统 Scoped Storage 原生删除授权，一键彻底释放几十 G 存储空间。
3. **专项清理通道**：
   - **截图专区**：自动过滤所有屏幕截图文件，快速清理无用截屏；
   - **视频瘦身**：扫描相册全部视频文件，按体积快速审阅；
   - **全量相册**：按时间倒序快速巡览全相册。
4. **日系轻相册清新美学 UI**：
   - 晨曦白与柔和薄荷绿自然配色，护眼治愈；
   - 底部 5 个触控大按钮，双手手势与单手轻点全场景适配。

---

## 📦 安装包下载

- **GitHub Release 直链**：[PhotoSwipe-v2.1.0.apk](https://github.com/WayneLu08/PhotoSwipe/releases/download/v2.1.0/PhotoSwipe-v2.1.0.apk)
- **体积**：~63 MB（独立离线脱机包，内嵌完整 Hermes JSBundle 与资源，开箱即用，免联网免配置）

### 🌟 v2.1.0 修复与优化亮点：
1. **顶层卡片与操作对象严格对齐**：彻底修复顶层卡片与底层操作对象错位问题，显式传递 `targetPhoto` 并加固 `zIndex: 10, elevation: 10`，确保划走哪张就处理哪张。
2. **新增「系统相册回收站」通道**：解决删除照片不在手机自带回收站显示的困扰，支持一键将待删照片安全移入手机自带相册的【🗑️PhotoSwipe-相册回收站】相册，随时可查看找回；同时保留一键彻底物理粉碎释放真实存储空间的能力。

---

<span id="english"></span>
## 🌟 English Overview

**PhotoSwipe · Lite Photo** turns overwhelming camera roll cleanup into a delightful, game-like experience:
- **Month-by-month Time Capsule**: Tackle photos grouped by year and month.
- **Staging Recycle Bin**: Swipe left to stage deletions without annoying permission popups, then batch purge in a single click.
- **Specialized Filters**: Quick modes for Screenshots and Large Videos.
- **Undo Anytime**: Smoothly rewind mistaken swipes.
- **100% Offline & Private**: Zero cloud uploads; your photos remain entirely on your device.

---

## 📄 License
MIT License © 2026 WayneLu08
