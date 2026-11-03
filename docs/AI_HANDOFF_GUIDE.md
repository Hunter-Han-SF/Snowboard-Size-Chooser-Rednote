# AI 接力开发交接手册 · Jones 26-27 雪板尺码助手 (Codex / Handoff Guide)

> **致接力的 AI 助手（Codex / Other Agent）**：
> 本手册详细记录了当前项目的架构设计、已验证的代码基线、用户已确认批准的视觉方案、生产好的高清物料资产，以及后续开发的具体落地步骤与严格限制。请仔细阅读后再进行后续开发。

---

## 一、项目核心背景与定位

- **项目名称**：26-27 Jones 雪板尺码选择助手（Snowboard-Size-Chooser-Rednote）
- **目标运行环境**：**手机端小红书 (Rednote) In-App Webview 竖屏**（iOS / Android，基准视口 390×844，向下兼容 320×568，向上兼容 430×932 及以上）。
- **运行规范**：纯前端离线运行，**零外部网络请求**（严禁引入 Google Fonts、CDN 库或远程图片），语言基线为 **ES2017 (Chrome 61+)**，最终打包产物必须控制在小红书离线小工具的 **2.0 MB** 预算以内。
- **当前 Git 分支**：`astra`

---

## 二、当前代码状态与基线验证 (Current Verified State)

当前工作区的代码已经历完整的系统化回归测试，所有交互链路与 DOM 渲染 100% 正常：

1. **`minitool/assets/main.js`**：
   - 核心推荐算法完整保留，涵盖 46 款 Jones 26-27 雪板全部规格数据；
   - 站姿出界估算已从旧 Canvas 方案重构成原生 DOM 条形图（`renderStancePanel`、`RCS_STATUS`、`stanceFootState`），双脚共用统一比例尺（`scaleMax`），原生文字渲染消除了缩放发虚问题；
   - 支持儿童 5 题问卷（`Youth Prodigy`）、手动调码对比、小红书 1500×2360 Canvas 超高清分享卡生成。
2. **`minitool/assets/style.css`**：
   - 已建立统一的 6 档圆角设计令牌（`--r-xs` 到 `--r-xl`），包含悬浮玻璃操作坞与 DOM 站姿条形图样式。
3. **自动化回归测试验证**：
   - 本地启动服务器（如 `python -m http.server 8791 -d minitool`），运行 `node tmp/qa2/regression.js`：
   - **测试结果**：19 项端到端链路全绿通过，`jsErrors=NONE`（0 报错），`stanceRows=2`，`stanceStatus=轻微蹭雪`。

---

## 三、用户已确认并批准的高级感设计方案 (Approved Design)

用户明确提出：**旧版浅色卡片（白底灰框）过于像“普通调查问卷”，缺乏顶奢户外装备应有的质感。**

经多轮产品设计提案与真机对比，用户最终选定并批准了 **【黑曜石暗夜座舱风】（Obsidian Alpine Cockpit / Dark Tech-Luxury）**。

### 核心设计原则（DNA）：
1. **深邃黑曜石基底**：全站底色统一为矿物冷黑（`#080c11`），卡片采用碳素烟熏毛玻璃（`rgba(14, 20, 28, 0.75)` + `backdrop-filter: blur(20px)`），搭配 1px 细微钛金属倒角微反光线（`rgba(255, 255, 255, 0.09)`）；
2. **香槟金金属压舱色**：**香槟金（`#f1d29a` ~ `#d4a755`）**作为全站核心品牌字标（JONES）、主推荐尺码数字（如 158W）、加宽版（WIDE）及主 CTA 金属渐变按钮的统一色彩；
3. **保留并升维“三色先锋主题流动”**：用户在首页拖动“灵活 / 均衡 / 稳定”滑块时，座舱自发光能量色瞬时切换：
   - **均衡 (Balanced · 默认)**：电光冰蓝 `#38bdf8` 能量轨 + 深海蓝宝辉光
   - **灵活 (Flexible · 偏短)**：电光翡翠绿 `#34d399` 能量轨 + 极光绿流光
   - **稳定 (Stable · 偏长)**：熔岩暮色红 `#fb7185` 能量轨 + 晚霞红宝石渐变

---

## 四、生产就绪的高清物料资产 (Production Ready Materials)

所有物料已生成并归档在仓库的 `materials/` 目录下，包含 **WebP（优化高压缩比版）** 与 **JPG（无损高清母版）**：

| 文件名称 | 尺寸 | WebP 大小 | 用途说明 |
| :--- | :--- | :--- | :--- |
| `materials/hero_obsidian_blue.webp` | 1376×768 | 194 KB | 均衡蓝 · 首页 Hero 卡片暗夜高山背景 |
| `materials/hero_obsidian_green.webp` | 1376×768 | 255 KB | 灵活绿 · 极光雪峰 Hero 背景 |
| `materials/hero_obsidian_red.webp` | 1376×768 | 238 KB | 稳定红 · 熔岩暮色日照金山 Hero 背景 |
| `materials/share_backdrop_blue_9x16.webp` | 768×1376 | 224 KB | 均衡蓝 · 9:16 小红书社交分享卡底图 |
| `materials/share_backdrop_green_9x16.webp` | 768×1376 | 167 KB | 灵活绿 · 9:16 极光绿分享卡底图 |
| `materials/share_backdrop_red_9x16.webp` | 768×1376 | 209 KB | 稳定红 · 9:16 熔岩暮色分享卡底图 |
| `materials/topographic_carbon_banner.webp` | 1376×768 | 248 KB | 钛金等高线与碳纤维 3D 浮雕（测试入口/抽屉 Banner） |

### 视觉预览参考图（存放于 `materials/previews/`）：
- `materials/previews/all_pages_preview.png`：**全套 4 屏联动真机渲染图**（用户最喜欢的标准稿，包含首页座舱、选板抽屉、结果遥测、分享卡弹层）；
- `materials/previews/tri_theme_preview.png`：**蓝 / 绿 / 红三套先锋主题实机对比图**；
- `materials/previews/3d_studio_concept_presentation.jpg`：工业级 3D 摄影棚概念渲染图。

---

## 五、设计规范文档索引

- **详细设计标准与 CSS 变量**：请查阅 [`docs/color_style_specification.md`](color_style_specification.md)，内含完整的 CSS 变量令牌（Neutral、Accent、Chroma-Cockpit、Telemetry Semantics）及数值表；
- **历史测试与优化记录**：请查阅 [`design-qa.md`](../design-qa.md)；
- **前端升级历程**：请查阅 [`docs/frontend-upgrade.md`](frontend-upgrade.md)。

---

## 六、接力 AI 的实施落地建议步骤 (Implementation Roadmap)

1. **步骤 1：物料替换与接入**
   - 将 `materials/` 中的 3 张宽屏背景替换或补充到 `minitool/assets/` 中，并在 `minitool/assets/style.css` 中配置按主题动态加载（如 `hero_obsidian_blue.webp` 等）；
   - 将 3 张 9:16 分享底图接入 `main.js` 中的 `CARD_THEMES`，用于 Canvas 分享卡导出。
2. **步骤 2：CSS 变量与黑曜石座舱样式应用**
   - 在 `minitool/assets/style.css` 中引入 `docs/color_style_specification.md` 定义的黑曜石深色基底、香槟金主渐变与三色流动变量；
   - 改造身体数据（`#bodySection`）为内凹式仪表仓与自发光滑块；
   - 改造站姿预设 chips 与滑行偏好滑块为碳素哑光质感；
   - 改造选板抽屉（`#modelPicker`）与结果页（`#resultView`）的玻璃层级。
3. **步骤 3：验证与打包**
   - 启动本地开发服务：`python tools/dev_server.py`（访问 http://127.0.0.1:8734/）；
   - 运行自动化回归测试：`node tmp/qa2/regression.js`，确保 19 项交互链路 0 报错；
   - 重新打包产物：`python tools/pack_minitool.py`，确保 `dist/jones-26-27-size-helper.zip` 体积在 2MB 以内。

---

## 七、⚠️ 绝不能违反的技术红线 (Critical Constraints)

1. **【致命红线】iOS 输入框字号必须 ≥ 16px**：
   - 在 iOS Webview 中，输入框（`<input>`）和下拉框（`<select>`）字号只要小于 16px，点击时整页会被强制放大导致左右出界切屏。**绝不能把控件字号调小至 15px 或以下**！
2. **保持 100% 纯离线**：
   - 严禁引入任何外链字体（如 Google Fonts）或外部 CDN。所有资源必须本地相对路径引用。
3. **保留底层算法与 DOM 节点 ID**：
   - 严禁修改或删除 `index.html` 中的既有 element ID（如 `#heightInput`, `#weightInput`, `#bootSelect`, `#rcsStatus`, `#rcsRows`, `#modelPicker` 等），`main.js` 依赖这些 ID 执行计算。
4. **安全区适配**：
   - 悬浮操作坞与底部抽屉必须保留 `env(safe-area-inset-bottom)` 计算，避免遮挡 iPhone 小白条。
