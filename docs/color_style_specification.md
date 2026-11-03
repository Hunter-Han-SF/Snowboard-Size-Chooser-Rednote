# Jones 26-27 雪板尺码助手 · 高清物料资产全集与设计标准规范

> [!IMPORTANT]
> **实现状态（2026-11-03）：用户已确认动效并授权实现。三色 Hero 与黑曜石视觉已接入真实页面；以功能和信息完整性为优先，原分享卡内容及版式保留。当前实现与验证见 [frontend-upgrade.md](frontend-upgrade.md)。以下保留最初物料规范供参考。**
> 本规范针对手机端小红书 In-App Webview 竖屏体验量身定制，遵循 **“单一黑曜石基底 + 三色流光座舱 + 香槟金金属压舱”** 的顶级高奢工业美学。

---

## 视觉物料资产全矩阵（7 张超清物料图）

已针对小红书离线小工具完成 **超清移动端 WebP 格式优化**（单张 160~250 KB，整套仅约 1.5 MB，首屏瞬时加载）与 **原始无损 JPG 母版** 归档。

### 1. 英雄卡片背景大图（16:9 / 4:3 宽屏）

````carousel
![均衡 · 冰川极蓝英雄图 (Blue Hero)](/C:/Users/Administrator/.gemini/antigravity/brain/690dc0dc-ad82-4013-8da8-9006c325f4b9/obsidian_alpine_hero_bg_1793184049413.jpg)
<!-- slide -->
![灵活 · 极光翡翠绿英雄图 (Green Hero)](/C:/Users/Administrator/.gemini/antigravity/brain/690dc0dc-ad82-4013-8da8-9006c325f4b9/jones_aurora_hero_bg_png_1793197895752.jpg)
<!-- slide -->
![稳定 · 熔岩暮色红英雄图 (Red Hero)](/C:/Users/Administrator/.gemini/antigravity/brain/690dc0dc-ad82-4013-8da8-9006c325f4b9/crimson_sunset_alpine_hero_1793197992987.jpg)
````

* **均衡蓝**：[`tmp/materials/hero_obsidian_blue.webp`](file:///f:/Git/Snowboard-Size-Chooser-Rednote/tmp/materials/hero_obsidian_blue.webp) (194 KB) · 午夜高海拔大山野雪全景，凌厉黑曜石山脊与冰蓝微光。
* **灵活绿**：[`tmp/materials/hero_obsidian_green.webp`](file:///f:/Git/Snowboard-Size-Chooser-Rednote/tmp/materials/hero_obsidian_green.webp) (255 KB) · 极夜极光缎带掠过雪峰，灵动电光翡翠绿辉光。
* **稳定红**：[`tmp/materials/hero_obsidian_red.webp`](file:///f:/Git/Snowboard-Size-Chooser-Rednote/tmp/materials/hero_obsidian_red.webp) (238 KB) · 壮丽熔岩晚霞日照金山，厚重沉稳赤红暮色。

---

### 2. 小红书 9:16 极奢分享卡高清底图（1500×2360 Canvas 导出专用）

````carousel
![均衡 · 冰川极蓝分享底图 (Blue 9:16)](/C:/Users/Administrator/.gemini/antigravity/brain/690dc0dc-ad82-4013-8da8-9006c325f4b9/jones_snowboard_luxury_backdrop_1793184043852.jpg)
<!-- slide -->
![灵活 · 极光翡翠绿分享底图 (Green 9:16)](/C:/Users/Administrator/.gemini/antigravity/brain/690dc0dc-ad82-4013-8da8-9006c325f4b9/jones_aurora_social_share_bg_png_1793198184737.jpg)
<!-- slide -->
![稳定 · 熔岩暮色红分享底图 (Red 9:16)](/C:/Users/Administrator/.gemini/antigravity/brain/690dc0dc-ad82-4013-8da8-9006c325f4b9/crimson_sunset_share_card_bg_1793198199075.jpg)
````

* **构图特征**：
  - 顶部 25% 预留品牌标识与系列标签；
  - 中右段平缓粉雪斜坡，完美契合 3D 雪板斜跨展示（旋转 12°~14°）；
  - 底部 35% 采用深邃冷黑暗影，保证个人身型数据、推荐尺码与站姿参数以纯白与香槟金呈现时达到顶级清晰度。
* **文件存储**：
  - 均衡蓝：[`tmp/materials/share_backdrop_blue_9x16.webp`](file:///f:/Git/Snowboard-Size-Chooser-Rednote/tmp/materials/share_backdrop_blue_9x16.webp) (224 KB)
  - 灵活绿：[`tmp/materials/share_backdrop_green_9x16.webp`](file:///f:/Git/Snowboard-Size-Chooser-Rednote/tmp/materials/share_backdrop_green_9x16.webp) (167 KB)
  - 稳定红：[`tmp/materials/share_backdrop_red_9x16.webp`](file:///f:/Git/Snowboard-Size-Chooser-Rednote/tmp/materials/share_backdrop_red_9x16.webp) (209 KB)

---

### 3. 高山等高线钛金科技感物料图（Banner / 测验卡底纹）

![高山等高线钛金科技概念图](/C:/Users/Administrator/.gemini/antigravity/brain/690dc0dc-ad82-4013-8da8-9006c325f4b9/jones_alpine_topographic_contour_banner_1793184056062.jpg)

* **文件路径**：[`tmp/materials/topographic_carbon_banner.webp`](file:///f:/Git/Snowboard-Size-Chooser-Rednote/tmp/materials/topographic_carbon_banner.webp) (248 KB)
* **用途**：首页“还没选好雪板？30秒小测试”入口卡片底纹、选板抽屉顶部装饰，强化专业地理测绘与大山滑行轨迹的硬核科技感。

---

## 颜色风格标准与设计令牌（Design Tokens）

### 一、全局黑曜石基底层（Neutral Scales）

> [!NOTE] 拒绝纯死黑（#000000），使用带有极低饱和冷蓝微光的极深矿物色阶，防止 OLED 发绿及文字刺眼。

```css
:root {
  /* 全局底层：黑曜石深邃矿物底 */
  --obsidian-base: #080c11;
  --obsidian-dark: #05070a;

  /* 界面材质层级 (Elevation) */
  --glass-surface: rgba(14, 20, 28, 0.75);      /* 主卡片：碳素烟熏毛玻璃 */
  --glass-well: rgba(6, 10, 15, 0.65);          /* 仪表仓：内凹物理槽底色 */
  --glass-dock: rgba(14, 20, 28, 0.90);          /* 操作坞：底部悬浮加重玻璃 */
  --glass-sheet: rgba(13, 18, 25, 0.96);         /* 抽屉弹层：高透防穿透背板 */

  /* 倒角微反光高光线 */
  --border-hairline: 1px solid rgba(255, 255, 255, 0.09);
  --border-highlight: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}
```

---

### 二、香槟金高奢金属压舱色（Champagne Gold Accent）

> [!TIP] 贯穿全场作为“尊贵压舱石”，无论主题如何切换，核心品牌标与大数字始终保有一流奢华品质。

```css
:root {
  --gold-primary: #f1d29a;                       /* 香槟主金：158W 大字号、WIDE 徽章 */
  --gold-bronze: #d4a755;                        /* 暖钛金属暗部：渐变辅助 */
  --gold-glow: rgba(241, 210, 154, 0.20);        /* 悬浮微光光晕 */
  --gold-border: rgba(241, 210, 154, 0.40);      /* 金属细微描边 */

  /* 主 CTA 按钮金属渐变与立体阴影 */
  --btn-gold-gradient: linear-gradient(135deg, #f1d29a 0%, #d4a755 100%);
  --btn-gold-shadow: 0 8px 24px rgba(212, 167, 85, 0.35);
  --btn-gold-text: #080c11;                      /* 按钮文字：黑曜石高对比黑（字重 800） */
}
```

---

### 三、三色先锋主题令牌（Chroma-Cockpit Tokens）

用户拖动滑块时，通过切换 `body` 上的 class（`.theme-bal`、`.theme-flex`、`.theme-stab`）在 **300ms** 内无缝渐变。

```css
/* 1. 均衡 · 冰川极蓝 (Balanced · Blue) */
body.theme-bal {
  --theme-accent: #38bdf8;                       /* 电光冰蓝 */
  --theme-deep: #0284c7;                         /* 深海蓝宝 */
  --theme-glow: rgba(56, 189, 248, 0.25);
  --theme-fill: linear-gradient(90deg, #38bdf8, #0284c7);
  --theme-active-chip: rgba(56, 189, 248, 0.15);
  --theme-active-border: rgba(56, 189, 248, 0.45);
  --theme-bg-ambient: radial-gradient(circle at 80% 10%, rgba(30, 80, 130, 0.35) 0%, transparent 60%);
  --hero-bg-image: url('hero_obsidian_blue.webp');
  --share-card-image: 'share_backdrop_blue_9x16.webp';
}

/* 2. 灵活 · 极光翡翠绿 (Flexible · Green) */
body.theme-flex {
  --theme-accent: #34d399;                       /* 电光翡翠绿 */
  --theme-deep: #059669;                         /* 冷杉极夜绿 */
  --theme-glow: rgba(52, 211, 153, 0.25);
  --theme-fill: linear-gradient(90deg, #34d399, #059669);
  --theme-active-chip: rgba(52, 211, 153, 0.15);
  --theme-active-border: rgba(52, 211, 153, 0.45);
  --theme-bg-ambient: radial-gradient(circle at 80% 10%, rgba(20, 80, 50, 0.35) 0%, transparent 60%);
  --hero-bg-image: url('hero_obsidian_green.webp');
  --share-card-image: 'share_backdrop_green_9x16.webp';
}

/* 3. 稳定 · 熔岩暮色红 (Stable · Red) */
body.theme-stab {
  --theme-accent: #fb7185;                       /* 熔岩暮色红 */
  --theme-deep: #e11d48;                         /* 红宝石深红 */
  --theme-glow: rgba(251, 113, 133, 0.25);
  --theme-fill: linear-gradient(90deg, #fb7185, #e11d48);
  --theme-active-chip: rgba(251, 113, 133, 0.15);
  --theme-active-border: rgba(251, 113, 133, 0.45);
  --theme-bg-ambient: radial-gradient(circle at 80% 10%, rgba(100, 30, 40, 0.35) 0%, transparent 60%);
  --hero-bg-image: url('hero_obsidian_red.webp');
  --share-card-image: 'share_backdrop_red_9x16.webp';
}
```

---

### 四、物理遥测出界数据语义色（Telemetry Semantics）

```css
:root {
  --status-safe: #4ade80;       /* 边刃干净 · 无蹭雪（发光安全绿） */
  --status-safe-bg: rgba(74, 222, 128, 0.15);
  --status-warn: #facc15;       /* 贴边安全 · 临界提示（荧光预警黄） */
  --status-warn-bg: rgba(250, 204, 21, 0.15);
  --status-danger: #f87171;     /* 最大出界 · 建议加宽（警示荧光红） */
  --status-danger-bg: rgba(248, 113, 113, 0.15);
  --waist-mark-line: rgba(255, 255, 255, 0.85); /* 板腰物理基准竖线 */
}
```

---

### 五、文字层级规范（Typography Hierarchy）

* **大标题 / 主数字**：`#ffffff`（纯白高光），强制启用 `font-variant-numeric: tabular-nums`，数字变动绝无晃动；
* **次级标题 / 型号名**：`#e2e8f0`（钛金属冷白）；
* **正文解读 / 推荐理由**：`#cbd5e1`（平滑灰白，行高 1.7）；
* **辅助说明 / 刻度标签 / 单位**：`#94a3b8` / `#64748b`（低饱和钛冷灰）；
* **控件防放大安全字号**：所有可输入框与下拉选择框 **严格保持 ≥ 16px**，根绝 iOS Webview 自动缩放 bug。

---

## 审批确认表单

请您检查以下 3 个维度的产物是否满足您的期望：

1. [x] **7 张高清物料图已就绪**：均衡蓝、灵活绿、稳定红对应的英雄图与 9:16 分享底图 + 钛金等高线 Banner；
2. [x] **WebP 与 JPG 双版本已准备**：小红书离线包优化版（单张 <250KB）与无损母版齐备；
3. [x] **颜色风格标准已确立**：黑曜石深色基底 + 香槟金高光 + 蓝/绿/红先锋主题动态切换规范。

请确认是否批准这套**高清物料与颜色风格标准**。一旦您批准通过，我将把这套素材与 CSS 样式规范无缝落地至项目中！
