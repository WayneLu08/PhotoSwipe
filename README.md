<div align="center">

# 🍃 相册管家 · Photomanager
### Swipe, Organize, Declutter — 专业的手机相册智能整理管家
**四向手势丝滑分类 · 时间胶囊按月攻坚 · 待删回收箱批量清理 · 智能过滤已审阅照片 · 分批防闪退架构**

<p align="center">
  <img src="https://img.shields.io/badge/Version-v2.2.0-emerald?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20Web-blue?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/Framework-React%20Native%20%2B%20Expo-61dafb?style=flat-square" alt="Framework" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/Build-GitHub%20Actions%20APK-orange?style=flat-square" alt="Build" />
</p>

[下载最新 APK (v2.2.0)](#-安装包下载) | [中文说明](#chinese) | [English](#english)

</div>

---

<span id="chinese"></span>
## 💡 为什么需要 相册管家 · Photomanager？

面对手机里积攒的成千上万张相片、过期的屏幕截图、随手拍下的模糊废片，你是否也觉得系统相册整理起来费时费力？
- **滑动一次弹窗一次？太烦人！** 相册管家引入**待删回收箱机制**，滑动时只暂存，整理完毕后一次性处理，绝不打断手感！
- **操作确认反复弹窗打扰？** 引入**【今日不再提醒】**免打扰选项，勾选后当天静默执行，流程行云流水！
- **返回主界面重复审核？** 引入**已审阅照片持久过滤队列**，筛选保留过的照片绝不重复出现！
- **大批量删除容易闪退崩溃？** 引入**分批分片串行处理架构 (Chunked Batching)**，解决系统 Binder IPC 事务与内存溢出瓶颈，千张批量删除稳如磐石！
- **上万张照片无从下手？** 引入**时间胶囊（按月整理）**，按年、月分组攻坚，整理完一个月自动打卡完成，成就感爆棚！
- **想快速清理无用截图和大视频？** 提供**截图专区**与**视频瘦身**专项筛选通道，一键抓出占用存储空间的元凶。

---

## ✨ 核心手势与操作规范

| 手势方向 | 对应动作 | 系统联动机制 | 交互特色 |
| :---: | :---: | :--- | :--- |
| **⬆ 上滑** | **❤️ 喜欢 / 收藏** | 物理加入系统专属相册「相册管家-精选喜欢」 | 自动创建或定位相册，支持跨卷复制兜底 |
| **⬇ 下滑** | **📁 收纳到相册** | 真实归档至系统既有相册或一键新建相册 | 弹出收纳抽屉，支持快速新建自定义分类 |
| **⬅ 左滑** | **🗑 移入待删箱** | 暂存至待删回收箱（不弹窗打断手感） | 顶部待删箱常驻角标，可随时复核并批量释放 |
| **➡ 右滑** | **✨ 保留相册** | 标记已审阅并留存相册 | 记录已筛选状态，绝不重复出现在审核队列 |
| **↩ 撤销** | **一键回退 (Undo)** | 平滑飞回卡片顶部，撤回对应操作 | 误滑手抖？支持无损回退历史动作 |

---

## 🚀 v2.2.0 核心功能与升级亮点

1. **待删回收箱双选项规范化**：
   - 【移入相册回收站】：安全将照片移入系统自带相册【🗑️相册管家-相册回收站】，随时可在手机相册中查看或找回；
   - 【彻底删除】：永久物理删除并粉碎照片，彻底释放手机本地磁盘空间。
2. **免打扰机制（今日不再提醒）**：
   - 触发批量操作时提供贴心确认弹窗，并提供“今日不再提醒”复选框；
   - 勾选后当天内自动保持授权，避免每次操作频繁弹窗打扰。
3. **已筛选照片持久排重过滤**：
   - 无论是保留、收藏、归档还是删除，已处理照片均自动加入持久过滤队列；
   - 执行完回收箱操作返回主界面后，之前保留的照片不会重复出现，无缝衔接下一批未整理相片。
4. **大批量删除分批防闪退引擎 (Chunked Batch Engine)**：
   - 针对成百上千张大批量删除，采用 50 张为一组的分片串行推进机制；
   - 微让渡主线程与释放底层 IPC 缓冲区，彻底解决系统底层 `TransactionTooLargeException` 导致的闪退问题。
5. **时间胶囊 · 按月整理与专项清理通道**：
   - 按月时间线分组，逐月攻克相册积压；
   - 内置“截图专区”与“视频瘦身”快速筛选入口。

---

## 📦 安装包下载

- **GitHub Release 直链**：[PhotoManager-v2.2.0.apk](https://github.com/WayneLu08/PhotoSwipe/releases/download/v2.2.0/PhotoManager-v2.2.0.apk)
- **体积**：~63 MB（独立离线脱机包，内嵌完整 Hermes JSBundle 与资源，开箱即用，免联网免配置）

---

<span id="english"></span>
## 🌟 English Overview

**Photomanager** turns overwhelming camera roll decluttering into an efficient, elegant experience:
- **Month-by-month Time Capsule**: Tackle photos grouped chronologically.
- **Staging Recycle Bin**: Swipe left to stage deletions without popups, then choose between **[Move to Trash Album]** or **[Permanently Delete]**.
- **Do Not Remind Today**: Check once to silence repetitive permission dialogues for the rest of the day.
- **Persistent Filter for Reviewed Photos**: Kept photos are automatically excluded so you never review the same photo twice.
- **Crash-proof Chunked Deletion**: Processes large batches in safe slices of 50 to prevent Android Binder IPC crashes.
- **100% Offline & Private**: Zero cloud uploads; your photos remain entirely safe on your device.

---

## 📄 License
MIT License © 2026 WayneLu08
