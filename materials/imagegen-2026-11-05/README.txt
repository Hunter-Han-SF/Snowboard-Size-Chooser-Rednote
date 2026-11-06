雪板高清素材与备用背景
完成日期：2026-11-06

交付内容
- 46 款雪板：AI 高清修复后进行本地透明遮罩精修，成品高度 2141–2170 像素。
- 6 张备用背景：蓝、红、绿各一张横版和一张独立构图的竖版。
  横版 1672 × 941，竖版 941 × 1672；均附 PNG 和 WebP。
- 项目 minitool/assets/boards 已使用精修后的 WebP，图片缓存版本更新为 v=6。
- 备用背景保存在本素材目录，尚未替换应用的默认主题背景。

目录说明
boards-clean/       推荐使用：精修后的透明 PNG 母版
boards-webp/        推荐使用：网页用透明 WebP，与 PNG 保持相同透明通道
backgrounds/       六张备用背景，各有 PNG 和 WebP
original-boards/   原始 46 款雪板 WebP 备份
boards/            图像工具输出的原始 AI PNG，尚未精修边缘

预览与记录
before-after.jpg          六款原图与精修结果对比
boards-preview-1~3.jpg    全部 46 款雪板分组预览
backgrounds-preview.jpg  蓝、红、绿横竖版背景总览
asset-manifest.json      所有原图、母版、成品的尺寸、体积与 SHA-256
board-refinement-report.json  透明边缘检查结果
prompts.json             图像生成/编辑模式及提示词记录
refine_assets.py          本地遮罩精修与原文字回贴脚本
finalize_assets.py        完整性校验、WebP 导出和预览生成脚本

制作说明
雪板使用内置 image_gen 图像编辑工具逐款处理，背景使用图像生成模式。
用户请求使用 image 2.6；当前工具不提供模型版本选择或可验证的版本标识，
因此无法确认实际调用的版本是 image 2.6。
本地精修已获用户同意：轮廓平滑、细小杂边清理、3 倍覆盖率抗锯齿、透明底导出。
AI 重绘可能改变细小画面细节；发现错误的微小标签后已回贴原始文字区域，
这些局部保持原图清晰度。儿童套装图片保留了原有包装内容。
原图与 AI 输出均保留，可用于复核与进一步精修。

重新运行脚本需 Python、Pillow、NumPy、SciPy 和 OpenCV。
运行 refine_assets.py 会重新生成精修雪板；运行 finalize_assets.py 会校验全部素材，
重新导出背景 WebP、清单与预览。脚本不会自动同步到 minitool。
