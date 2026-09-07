# -*- coding: utf-8 -*-
"""data/jones-specs.json -> minitool/assets/data.js（全局变量，供离线 H5 使用）"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = json.loads((ROOT / "data" / "jones-specs.json").read_text(encoding="utf-8"))
# 官方产品文案（tools/extract_board_copy.py 从目录介绍页提取）
copy = json.loads((ROOT / "data" / "jones-copy.json").read_text(encoding="utf-8"))

# 型号一句话介绍（结合目录内容与系列定位）
DESC = {
    "Freecarver 6000s": "软靴刻滑旗舰，6 米级侧切半径，硬雪上如轨道般稳定的卡宾机器",
    "Freecarver 9000s": "9 米大半径侧切，高速大开大合的长弯刻滑，Freecarver 的极致版",
    "TwinCraft": "全新粉雪自由式板型，超宽腰身 + 短有效边刃，浮力、弹性、转体随心切换",
    "Mind Expander 2.0": "冲浪系列经典之作，宽板腰 + 大 rocker 板头，粉雪漂浮感拉满",
    "Storm Chaser": "短宽身激进侧切的粉雪冲浪板，林间与陡粉的穿梭利器",
    "Storm Wolf": "Storm Chaser 加长版，大脚滑手专享的粉雪冲浪体验",
    "Hovercraft 2.0": "紧凑板身大浮力的全能野雪板，一天粉雪的可靠伙伴",
    "Ultralight Butterfly Split": "冲浪板型轻量分离板，进山寻找无人粉雪的翅膀",
    "Ultralight Hovercraft 2.0 Split": "Hovercraft 超轻分离版，登顶更省力，下坡更尽兴",
    "Hovercraft 2.0 Split": "粉雪分离板经典，浮力与背负便携兼得",
    "Storm Chaser Split": "Storm Chaser 分离版，雪坡冲浪的进山首选",
    "Men’s Ultralight Project X": "旗舰材料科技集大成者，每一克都为下坡性能而生",
    "Men’s Flagship Pro": "Jeremy Jones 的大山竞技武器，最高速最硬雪也稳如铁轨",
    "Men’s Flagship": "大山野雪标杆旗舰，陡峭硬雪与深粉通吃的全能王者",
    "Men’s Howler": "全新定向野雪板，宽板头 + Power 板尾，深粉里的快乐源泉",
    "Men’s Stratos": "定向全能板：板头浮力 + 真双板尾，野雪与道内一板通吃",
    "Men’s Frontier 2.0": "宽容度极高的全能野雪板，进阶玩家的成长伴侣",
    "Men’s Aviator 2.0": "真双形状 + 定向性格，道内刻滑与技术滑行的主力板",
    "Men’s Mountain Twin Pro": "竞技版全能双向板，公园到大黑道全面高性能",
    "Men’s Mountain Twin": "全能双向标杆，正反脚表现一致，全山自由式首选",
    "Men’s Rally Cat": "定向全能 rally 板，入弯快响应直接，粉雪里也能冲",
    "Men’s Tweaker Pro": "竞技版自由式板，更强弹射与落地稳定性，大跳台利器",
    "Men’s Tweaker": "中等硬度自由式全能板，公园平花与全山玩法兼顾",
    "Men’s Ultralight Solution": "旗舰轻量分离板，长距离探险的效率之王",
    "Men’s Solution": "大山分离板标杆，Jeremy Jones 探险常备座驾",
    "Men’s Howler Split": "Howler 分离版，粉雪漂浮与登山的双赢选择",
    "Men’s Stratos Split": "Stratos 分离版，定向全能进山首选",
    "Men’s Frontier 2.0 Split": "Frontier 分离版，分离板入门的友好之选",
    "Women’s Flagship": "女款大山旗舰，陡硬雪与深粉的高性能武器",
    "Women’s Howler": "女款全新野雪板，轻快灵活的深粉玩家",
    "Women’s Stratos": "女款定向全能，板头浮力与操控性的平衡之作",
    "Women’s Dream Weaver 2.0": "女款野雪全能板，轻量易控，陪你从道内滑向道外",
    "Women’s Airheart 2.0": "女款全能板，道内刻滑到道外探索的可靠伙伴",
    "Women’s Twin Sister": "女款双向全能，正反脚一致的自由式万金油",
    "Women’s Rally Cat": "女款定向全能 rally 板，快速入弯，粉雪畅行",
    "Women’s Tweaker": "女款自由式板，公园平花的友好起点",
    "Women’s Solution": "女款分离板，野雪探险的标准装备",
    "Women’s Howler Split": "女款 Howler 分离版，轻量粉雪进山",
    "Women’s Stratos Split": "女款 Stratos 分离版，定向全能登山",
    "Women’s Dream Weaver 2.0 Split": "女款 Dream Weaver 分离版，轻盈探险",
    "Flagship Junior": "青少年版旗舰，大山性能从小培养",
    "Mountain Twin Junior": "青少年双向全能，全山技术的成长首选",
    "Twin Sister Junior": "青少年女款双向板，自由式与全山启蒙",
    "Solution Junior": "青少年分离板，家庭野雪探险的入场券",
    "Kids Prodigy Package": "儿童首板套装（板 + 固定器），第一步一步到位",
    "Youth Prodigy": "儿童全能板，从第一趟滑行到全山探索",
}

def slug(name):
    s = name.replace("’", "").replace("'", "")
    return re.sub(r"[^0-9A-Za-z]+", "-", s).strip("-").lower()

CAT_ORDER = ["全山野雪", "全山", "全山自由式", "自由刻滑", "冲浪系列"]
CAT_DESC = {
    "全山野雪": "大山与粉雪，定向板型，高速稳定",
    "全山": "道内道外通吃，一颗板滑全山",
    "全山自由式": "公园平花与全山玩法兼顾",
    "自由刻滑": "刻滑走刃，高速卡宾转弯",
    "冲浪系列": "冲浪板基因，粉雪漂浮感",
}

out = []
AUD_ORDER = ["男款", "通用", "女款", "儿童"]
for m in sorted(src, key=lambda x: (CAT_ORDER.index(x["category"]),
                                    AUD_ORDER.index(x["audience"]), x["name"])):
    sizes = []
    for s in m["sizes"]:
        sizes.append({
            "size": s["size"], "len": s["length_cm"], "variant": s["variant"],
            "wMin": s["weight_kg_min"], "wMax": s["weight_kg_max"], "wOpen": s["weight_kg_open"],
            "usMin": s["boot_us_min"], "usMax": s["boot_us_max"],
            "euMin": s["boot_eu_min"], "euMax": s["boot_eu_max"],
            "bigHorn": s["big_horn"], "flex": s["flex"], "waist": s["waist_cm"],
            "effEdge": s["eff_edge_cm"], "stance": s["stance_cm"],
            "nose": s["nose_cm"], "tail": s["tail_cm"],
        })
    img_path = ROOT / "minitool" / "assets" / "boards" / (slug(m["name"]) + ".webp")
    # ?v= 缓存版本号：图片更新后改 v 值即可强制刷新
    img_url = ("./assets/boards/" + slug(m["name"]) + ".webp?v=5") if img_path.exists() else ""
    c = copy.get(m["name"], {})
    row = {
        "name": m["name"], "audience": m["audience"], "category": m["category"],
        "catDesc": CAT_DESC.get(m["category"], ""), "isSplit": m["is_split"],
        "isNew": m["is_new"], "desc": DESC.get(m["name"], ""),
        "img": img_url,
        "sizes": sizes,
    }
    # 官方文案字段（缺失的保持空，前端按需展示）
    for k in ("tag", "pitch", "intro", "bullets", "scores", "shape", "profile", "character"):
        if c.get(k):
            row[k] = c[k]
    out.append(row)

js = ("// Jones 2026-27 雪板规格数据（由 tools/build_data.py 从 PDF 目录提取生成）\n"
      "window.JONES_DATA = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
      "window.JONES_CATEGORIES = " + json.dumps(CAT_ORDER, ensure_ascii=False) + ";\n")

dst = ROOT / "minitool" / "assets" / "data.js"
dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(js, encoding="utf-8")
print(f"{len(out)} models, {sum(len(m['sizes']) for m in out)} sizes -> {dst} ({dst.stat().st_size/1024:.1f} KB)")
