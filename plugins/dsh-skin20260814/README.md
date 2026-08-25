# Skin20260814 (dsh-skin20260814)

<div align="center">

[![Official Marketplace](https://img.shields.io/badge/Marketplace-deepseek.stream-0ea5e9?style=for-the-badge&logo=google-chrome&logoColor=white)](https://deepseek.stream/plugins/dsh-skin20260814)
[![Topic dsh-plugin](https://img.shields.io/badge/Topic-dsh--plugin-3b82f6?style=for-the-badge&logo=github&logoColor=white)](https://github.com/topics/dsh-plugin)
[![License MIT](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)

<br />

<!-- DeepSeek Harness 桌面端一键安装徽章 -->
<a href="dsh://plugin/install?id=dsh-skin20260814&name=Skin20260814&version=1.0.0&repo=shigu4795-design%2Fdeepseek-plugins-storage&permissions=network%2Cfilesystem">
  <img src="https://img.shields.io/badge/Install%20in-DeepSeek%20Harness-0ea5e9?style=for-the-badge&logo=deepseek" alt="一键安装到 DeepSeek Harness 桌面端" />
</a>

</div>

---

## 📖 插件介绍

dsh-skin 增强版：为 DeepSeek Harness 提供皮肤切换与自定义背景壁纸。在原版基础上修复了两处问题——① 大图/特殊格式上传无响应（改用 createImageBitmap 直接解码、增加处理中与错误提示）；② 主题切换时 overrideTokens 触发 theme/change 导致无限递归栈溢出（加皮肤/明��守卫断开循环）。壁纸存储从 localStorage 压缩方案改为 IndexedDB 原文件直存，全画质显示、零压缩，并自动迁移旧数据。

---

## ⚡ 安装方法

### 方法一：桌面客户端一键安装（推荐）
在 [DeepSeek 插件市场](https://deepseek.stream/plugins/dsh-skin20260814) 点击 **「一键安装到桌面版」** 即可免配置秒级装载。

### 方法二：终端命令行安装
```bash
dsh plugin add "https://deepseek.stream/api/plugins/download?id=dsh-skin20260814"
```

---

## 📄 许可证
[MIT License](LICENSE)
