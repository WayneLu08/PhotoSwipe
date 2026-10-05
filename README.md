<div align="center">

# 📱 相册管家 · Photomanager
### Swipe, Organize, Declutter — 高效手势整理 · 智能空间清理
**四向手势丝滑整理 · 时间胶囊按月攻坚 · 待删回收箱双模式 · 免打扰智能确认**

<p align="center">
  <img src="https://img.shields.io/badge/Version-v2.1.1-emerald?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20Web-blue?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/Framework-React%20Native%20%2B%20Expo-61dafb?style=flat-square" alt="Framework" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

[功能亮点](#功能亮点) | [核心交互](#-核心手势与交互) | [更新日志](#-更新日志) | [English](#english)

</div>

---

<span id="功能亮点"></span>
## 💡 为什么选择「相册管家 · Photomanager」？

面对手机中积攒的成千上万张相片、过期的屏幕截图、随手拍下的模糊废片，系统相册的手动整理往往低效而繁琐：
- **滑动整理不打断手感**：引入**待删回收箱机制**，左滑仅作暂存，整理完毕后一次性统一处理，无需每张都触发系统授权。
- **双重安全删除模式**：待删回收箱提供【移入相册回收站】（安全移入系统相册回收站，随时可撤销找回）与【彻底删除】（永久删除，彻底释放存储空间）两种独立处理通道。
- **免打扰智能确认**：操作弹窗支持「今日不再提醒」选项，开启后当日批量操作直接执行，告别重复弹窗打扰。
- **已筛选相片排重机制**：已保留、收藏、归档或标记待删的照片自动进入已审阅列表，返回主界面或批量处理后绝不重复展示，整理流畅不走回头路。
- **时间胶囊按月整理**：按年份与月份自动聚合，支持单月定点攻坚与通关进度追踪，告别相册整理焦虑。

---

## ✨ 核心手势与交互

| 手势方向 | 对应动作 | 系统联动机制 | 交互特色 |
| :---: | :---: | :--- | :--- |
| **⬆ 上滑** | **❤️ 收藏精选** | 物理加入系统专属相册「精选收藏」 | 自动定位系统相册，支持跨卷保存 |
| **⬇ 下滑** | **📁 归档相册** | 归档至系统既有相册或一键新建相册 | 弹出收纳抽屉，支持自定义分类相册 |
| **⬅ 左滑** | **🗑 移入待删** | 暂存至待删回收箱（不打断手势） | 顶部待删箱常驻角标，可随时复核并批量处理 |
| **➡ 右滑** | **✨ 留在相册** | 原相册留存，标记已审阅 | 标记保留，直接推进至下一张未审阅照片 |
| **↩ 撤销** | **一键回退 (Undo)** | 平滑飞回卡片顶部，撤回对应操作 | 支持无损回退误操作与恢复已审阅状态 |

---

## 🚀 核心功能全景

1. **待删回收箱 · 双通道处理**：
   - **【移入相册回收站】**：安全移入系统自带相册回收站，保留30天随时可找回，且不在手机相册中创建多余的冗余相册。
   - **【彻底删除】**：永久粉碎选定照片，彻底释放设备宝贵存储空间。
2. **今日不再提醒 · 智能免打扰**：
   - 确认对话框内置“今日不再提醒”复选框，勾选后当天内再次执行批量操作自动跳过确认弹窗，丝滑高效。
3. **已审阅排重 · 告别重复审核**：
   - 全局追踪已筛选照片集合，从回收箱处理完毕返回主界面后，之前保留的照片绝不再次出现，自动顺延展示新照片。
4. **时间胶囊 · 按月整理**：
   - 自动提取拍摄时间，按年、月分组聚合成独立卡片堆，进度百分比实时展示。
5. **专项清理通道**：
   - **截图专区**：一键筛选全部屏幕截图；
   - **视频瘦身**：扫描相册全部大视频文件；
   - **全量相册**：按时间倒序快速巡览全相册。

---

## 📝 更新日志

### 🌟 v2.1.1 优化亮点：
1. **应用品牌升级**：正式更名为「相册管家 · Photomanager」，全界面采用专业清晰的视觉与交互语言。
2. **待删回收箱按钮规范**：明确拆分为【移入相册回收站】与【彻底删除】两大标准操作。
3. **免打扰确认弹窗**：新增「今日不再提醒」机制，当天免打扰，避免重复弹窗确认。
4. **主界面排重机制**：已筛选过的照片不再重复出现，回收箱处理后无缝继续整理新相片。
5. **杜绝多余相册生成**：去除历史版本中额外创建回收站相册的逻辑，纯净联动系统相册。

---

<span id="english"></span>
## 🌟 English Overview

**Photomanager** delivers a fast, gesture-driven approach to cleaning and decluttering your photo library:
- **Two-way Purge Modes**: Support for moving to the system gallery trash (safe and recoverable) or permanently deleting to free up disk space.
- **Do Not Disturb for Today**: "Don't remind me today" option to bypass repeated confirmations on subsequent purges.
- **Deduplication Filter**: Photos that have already been reviewed (kept, favorited, archived, or trashed) will never appear repeatedly upon returning to the main deck.
- **Time Capsules**: Organize photos effortlessly grouped by year and month.
- **100% Offline & Private**: Zero cloud uploads; your photos remain entirely on your device.

---

## 📄 License
MIT License © 2026 WayneLu08
