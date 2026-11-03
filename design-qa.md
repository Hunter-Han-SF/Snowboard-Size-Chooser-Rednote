# Design QA · 2026-10-28

## Visual truth and captures

- Source: `C:/Users/ChoraiSuperUser/.codex/generated_images/01a18065-c869-7f32-9004-23898f5a5947/exec-e1cce698-005b-4f9e-ab79-0f32d95597fd.png` (first displayed ideation result, selected by user).
- Source raster: 853×1844; intended logical viewport: 390×844. Compared at matching logical width (~0.457 source scale), without stretching image assets.
- Implementation: `tmp/alpine-blue-390.png`, `tmp/alpine-green-390.png`, `tmp/alpine-red-390.png`; each 390×844 pixels / 390×844 CSS viewport (capture density 1).
- Narrow-screen evidence: `tmp/alpine-long-320.png`, 320×568.
- State: default Men's Howler, 175cm / 70kg, initial form; each screenshot activates its respective preference.
- Local browser: http://127.0.0.1:8734/ . Reference and rendered capture were opened together for full-view comparison; final color captures also inspected together.

## Required fidelity surfaces

- Typography: bold uppercase product title, smaller Chinese tagline, large editable measurements, compact brand header. Local system Chinese fonts and Arial avoid external requests. Long model names use a smaller size; word breaking verified at 320px. Original generated JONES lettering is represented by the existing project text wordmark; it is not an official logo asset.
- Layout: full-width alpine hero, product to the right, quiz strip, two-column measurements, three-way preference selector and one primary button. At 390×844 the CTA fits within the first screen. Narrow phones scroll naturally; no horizontal layout is introduced.
- Colors: intentional user change from mock's green CTA to balanced blue (#225b83), flexible green (#23624c), stable red (#a43e4b). Corresponding soft surfaces and dark result panels remain within each palette.
- Images: real transparent board assets preserved without distorting aspect ratios; new snowy mountain photography generated from the selected reference, stored locally as alpine-day.webp. Hero is slightly shorter than the mock to accommodate actual native input metrics and 44px touch targets. Original supplied board silhouette is narrower than the generated mock's depiction; preserving real product proportions is intentional.
- Copy: actual official product tagline retained (rather than the mock's generated copy); supported range labels are the real 120–205cm / 20–120kg. Existing algorithms, detailed specifications and optional controls remain accessible.
- Focused regions: title/product overlap, contrast of change-board action, numeric input/units, preference slider and complete CTA inspected at full 390px and 320px rendered sizes; no extra crops required because these captures show readable pixels directly.

## Comparison and repair history

1. P2: initial desktop-style scrollbar reduced usable portrait width and CTA was below the 844px fold. Hid scrollbar gutter, adjusted hero/spacing; final blue capture shows full CTA.
2. P2: 320px long title broke HOVERCRAFT within a word; reduced long-title font to 22px at narrow width. Final alpine-long-320.png shows whole words.
3. P2: change-board action overlapped dark rocks; added a light translucent surface. Final three theme captures show readable label and arrow.
4. P2 behavior: selected-board dialog focus trap omitted summary. Added summary and verified Tab → confirmBoard → modelClose.
5. P2 behavior: page overflow hidden prevented result toolbar from sticking to viewport. Removed clipping from the outer page. Browser DOM reports toolbar bottom 844 in 844px viewport.

## Interaction verification

Three theme selections; body-number input sync; search/empty/recovery; long-model selection; modal open/close/Escape/Tab; result transition and return; optional EU44/stance preset and Canvas; 1500px share image preview; complete child questionnaire and prefilled return to form. Browser error/warning log checked. No application errors observed.

## Follow-up polish and limits

No remaining actionable P0/P1/P2 findings. Device font rasterization can differ slightly from Chromium. Actual iPhone safe area/keyboard, native Rednote bridges and reduced-motion OS setting were not exercised on a real device; reduced-motion CSS and JS fallback paths were inspected. No device frame-rate claim is made.

Prior iteration result: superseded by feedback below.

## Feedback correction — preserve functionality, restore original result styling

The user's newest instruction overrides the compact form arrangement: all shoe, stance and style inputs must be visible on the home form. The first-screen CTA requirement above no longer applies. Main JS is byte-for-byte unchanged during this correction.

Source: original repository result CSS at HEAD (dark glass card) + existing alpine imagery + explicit feedback. This is a restoration of the result styling, not a new image-based design selection.

Current evidence:
- `tmp/restored-home-fields.png`: 390×844, EU43 and stance inputs/presets directly visible.
- `tmp/restored-result-top.png`: 390×844, stable red result, Frontier 2.0 Split, 159.
- `tmp/restored-stance.png`: 390×844, visible original Canvas and explanatory values.

Typography/layout: result title 24px, model 15px, size 78px, full-width explanation; transparent hero area inside one continuous dark glass card. Original supplied board image proportions retained. Contrast: pale text and hairline dividers over dark glass, theme-matched night background. Corrected hierarchy: recommendation → size chooser → stance detection → matching evidence → always-visible official specs. The original Canvas rendering is deliberately unchanged; explanatory text carries readable values on small phones.

Resolved P1: hidden shoe/angle input affordances. Resolved P1: flat white result styling replacing original atmosphere. Resolved P2: specs required an extra expansion action. Algorithm and stance visibility conditions unchanged.

Verified: all form controls visible without details expansion; full stance computation; manual 159→158W recalculates 1.6→0.6cm; 320/390/430px no horizontal overflow; sticky controls at viewport bottom; main.js equality and data check. Earlier device/bridge testing limits still apply.

final result: passed

## Polish pass · 2026-10-28 (v2.1)

在 ASTRA 版本基础上的系统性整理，主 JS 算法与交互逻辑未改动（main.js 仅验证未修改）。

- style.css 整体重写：清除四层补丁叠加（同一选择器多次定义互相覆盖），改为单一组织结构；建立 6 档圆角令牌（6/10/14/18/24px + 胶囊），输入框 14 / chips 10 / 主卡 20 / 弹层 24 / 分段控件与徽章胶囊化，全站圆角统一。
- 排版修复：站姿角度标题行重排（主标签 + 小注 + 右侧胶囊切换，360px 以下切换条整行铺开）；结果页雪板图下移避开 YOUR FIT 标签重叠；结果页底部改为悬浮玻璃操作坞（sticky + 毛玻璃）。
- 缺陷修复：恢复 body.is-editing 收起底部操作坞规则（ASTRA 重写时丢失）；修复问卷结果页 quiz-actions 与 result-actions 双 sticky 重叠导致的按钮误触（elementFromPoint 命中验证）。
- 回归验证（puppeteer-core + 本机 Chrome，tmp/qa2）：19 项交互链路全部通过（选板/搜索/匹配/手动改码/主题切换/问卷全流程/分享卡生成）；320/390/430px 九个视图 docOverflow=0、元素级横向溢出 0；无 JS 报错（仅本地服务器 favicon 404，与产物无关）。

## Stance panel rework · 2026-10-28 (v2.2)

站姿出界检测从 Canvas 改为 DOM 渲染。动机：Canvas 逻辑宽 660px 显示在约 310px 面板内，全部文字被等比缩至约 0.47 倍（最小字号实际 ~6px），是可读性差的主因。

- 新结构：面板头（标题 + 状态徽标 边刃干净/轻微蹭雪/建议加宽）→ 每脚一行（脚名+角度、状态值、共用比例尺的圆角条形图：绿色板腰内投影 + 红色出界段 + 白色板腰阈值线及标签、参考数值行）→ 结论卡（参数行/数值行/彩色判定行三层层级）→ 底注。
- 出界口径不变：阈值判定（>0.15 出界 / >-0.5 贴边）与数值来源（fOh/bOh/wF/wB/fOhPos/bOhPos）沿用原逻辑；删除 drawStanceDiagram（约 140 行），新增 renderStancePanel。阈值标签在 >76% 位置时右锚定防溢出。
- 验证：19 项交互回归通过（stanceRows=2、状态徽标随场景变化）；warn（EU44 +15/-15）与 bad（EU49，红色出界段 + 建议加宽）双场景视觉审查通过；320/390/430px 溢出审计全 0。

## Picker sheet rework · 2026-10-28 (v2.3)

用户反馈「选择你的雪板」弹层不如之前好看。新旧对比定位到三处回归：搜索框与型号下拉同为灰底圆角框同质化（主次不分）、评分条轨道对比度不足（亮点数据被埋没）、纯文字预览区缺少视觉锚点。

- 搜索框升级为主输入：白底 + 边框 + 放大镜图标（SVG data URI，无外部请求）；型号下拉弱化为次级：浅底无边框 44px/14px。
- 新增 `.bp-preview` 组件：雪板缩略图（max-height 148px，比例不变形）+ 可选尺码/标语/标签左图右文布局；缩略图与首页大图在 renderModelMeta 中同步，无图型号自动隐藏占位。
- 评分条：轨道 4px→6px、底色 line→ice、标签/数值加粗右对齐。
- 板型、硬度与官方介绍 details 默认展开（open 属性）。
- 验证：弹层视觉审查通过（主次区分/缩略图/评分条/详情区均无问题）；溢出审计 0；19 项交互回归全过。
- 追加（用户反馈"两边蹭到边缘"）：实测弹层内容左右边距原本为 20/22/24px 三种不一致，统一为 26px（sheet 左右 padding 22→26，picker-content 去掉 2px 内补），chips 可见缘与标题/搜索/CTA 完全对齐；复测三档视口（390/520/760）边距一致，视觉审查确认贴边感消除。
- 追加（用户反馈"点击搜索框/下拉框后两侧出界"）：真机 in-app browser 中 iOS 对字号 <16px 的可聚焦控件会整页自动放大，放大后两侧内容切出屏幕（桌面 Chrome 复现不了）。根因是本轮把 search-input（15px）与 select（15/14px）从 ASTRA 版的 16px 下调所致。修复：所有 select 与 search-input 字号恢复 16px（次级下拉仅保留浅底无边框作层次，不再用小字号）。回归 19 项通过，溢出审计 0。

## Obsidian cockpit & visual materials · 2026-11-03 (v2.4)

针对小红书移动端高级感重构，确立【黑曜石暗夜座舱风 (Obsidian Alpine)】视觉标准并完成全套高清物料生产：
- 风格确立：矿物黑曜石冷暗底（#080c11）+ 碳素烟熏毛玻璃卡片（blur 20px）+ 钛金属高光线，搭配贯穿全场的香槟金（#f1d29a）金属压舱色；
- 三色流动：保留均衡蓝（#38bdf8）、灵活绿（#34d399）、稳定红（#fb7185）三套先锋主题，在黑曜石座舱中实现自发光能量流动；
- 物料交付：已生成 7 张超清 WebP/JPG 素材于 materials/ 目录（宽屏背景 3 张、9:16 小红书分享底图 3 张、等高线 Banner 1 张），并在 materials/previews/ 提供全套 4 屏联动真机渲染稿；
- 交接就绪：产出 docs/AI_HANDOFF_GUIDE.md 与 docs/color_style_specification.md，记录完整的技术红线、CSS 变量令牌与实施步骤。


## 2026-11-03 · Obsidian implementation, complete content retained

Source of truth: astra `72b6e22` for all content and interactions; user-approved blue/green/red mountain motion prototype for visual treatment. Reviewed `images/blue-main.png` from the November 3 visual exploration alongside the real 390px page and complete result capture. The concept simplified fields and specifications; the user's latest instruction explicitly requires the production page to retain them. This deliberate content/layout difference takes precedence over pixel cloning.

### Visual review and evidence

Real browser captures live in `tmp/obsidian-qa/` (local QA artifacts, not shipped):

- `before-home.jpg`: original full page baseline.
- `blue-home-full.jpg`, `green-home-full.jpg`, `red-home-full.jpg`: complete forms, preserving every field, five stance presets, seven riding styles, explanatory copy and footer.
- `blue-result-full.jpg`: full result including manual size selector, stance, matching evidence, official specifications and alternatives.
- `blue-share.jpg`: share preview retaining the existing complete card.
- `red-quiz-audience.jpg`, `red-quiz-weight.jpg`, `red-adult-result-full.jpg`, `child-result-full.jpg`: questionnaire and recommendation evidence.
- `long-model-320-full.jpg`, `result-320-full.jpg`, `result-430.jpg`, `desktop.jpg`: responsive review.
- `final-home-390.jpg`: final default hero and form entry.

The original mock's compressed data fields and collapsed stance/specification areas were intentionally rejected. Real model names, real board aspect ratios, all help text and natural vertical scrolling remain. The existing card artwork is intentionally retained to avoid dropping baked-in headings or card details. Warm gold actions and size numerals, theme-colored active states, dark surfaces, bright readable labels, scenic depth and diffuse light are implemented across the actual views.

Fixed during QA: rotating hero extended 8px beyond the mobile viewport; gave the decorative hero its own clipping boundary and adjusted board inset. The outer page remains unclipped so sticky result actions still work. Development browser reused old CSS; versioned the stylesheet URL and reloaded to verify the actual new rules. All continuous animation now uses opacity/transform, including the button light sweep.

### Content and functional checks

- Exact preservation check: all 88 original IDs/attributes, 51 controls/expansion states, 101 body text segments. Main business JS and complete data unchanged.
- Main sample: Howler, 175cm / 70kg / EU45, +15/-15. Initial 155: waist 25.4cm, overhang 2.9cm. Manual 157W: waist 26.4cm, overhang 1.9cm; explanation, table and bars update together.
- All five stance presets set their original angle pairs; right-foot-first reverses field order. Empty shoe/angles do not display stance estimates. Numeric 180/80 inputs synchronize their sliders.
- Picker: 46 boards, women's filter 12; search empty state disables confirmation; clear/filter restores options; full official description/specification disclosures remain open. Long Ultralight Hovercraft 2.0 Split title and change-board action fit at 320px.
- Keyboard: details summary → confirm → close focus cycle; Escape closes picker and restores change-board focus.
- Adult: all 8 questions including options and progress verified; 170–179cm / 70–79kg / EU45 / intermediate / freeride / stable / lift leads to Flagship 162W. Alternative switches to Flagship Pro; return fills 175cm / 75kg / EU45 with stable preference.
- Child: all 5 questions, previous-answer retention; 130–139cm / 30–34kg / EU33 / linked turns / piste leads to Youth Prodigy. Return fills 135cm / 32kg / EU33.
- Browser share image natural dimensions 1500×2360. Save/preview/close controls work; unchanged native bridge implementation retained.
- Widths 320, 390, 430 and 1280: document scroll width equals viewport width. Result dock remains visible; specifications and long descriptions remain naturally scrollable.
- Browser warning/error log empty. Motion unit checks cover pause/resume, legacy media-query listener, reduced-motion precedence, background suspend/resume with pause retained, pointer-frame cancellation and no touch parallax.

### Independent review and boundaries

Read-only independent code review approved with no actionable regressions. Accepted review boundaries: manual pause stops continuous decorative motion, while user-triggered theme/view transitions remain; the system reduced-motion setting disables both. Native Android 8.1 / Rednote bridges, true keyboard/safe areas and device frame rates require device testing; no device performance claim made. Picker thumbnail `bpPreviewImg` was already unassigned in the baseline and remains unchanged; no previously visible information was removed. Its existing textual specifications, official description and model selection remain functional.

Final package and static check results are recorded in `tmp/obsidian-qa/verification.txt`. Package contains only local runtime assets. Final result: passed (browser and static checks; native device verification not performed).
