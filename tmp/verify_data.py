# -*- coding: utf-8 -*-
"""数据核对：data.js vs specs_desktop.json 逐字段比对 + 全库物理一致性校验。"""
import json
import re

specs = json.load(open('tmp/specs_desktop.json', encoding='utf-8'))
src = open('minitool/assets/data.js', encoding='utf-8').read().split('window.JONES_CATEGORIES')[0]
data = json.loads(src[src.index('['): src.rindex(']') + 1])

ns = {m['name']: m for m in specs}
nd = {m['name']: m for m in data}
print('models: data.js', len(nd), '/ specs', len(ns),
      '| 仅 specs:', set(ns) - set(nd), '| 仅 data:', set(nd) - set(ns))

# build_data.py 的字段映射
MAP = [
    ('len', 'length_cm'), ('variant', 'variant'), ('wMin', 'weight_kg_min'),
    ('wMax', 'weight_kg_max'), ('wOpen', 'weight_kg_open'), ('usMin', 'boot_us_min'),
    ('usMax', 'boot_us_max'), ('euMin', 'boot_eu_min'), ('euMax', 'boot_eu_max'),
    ('bigHorn', 'big_horn'), ('flex', 'flex'), ('waist', 'waist_cm'),
    ('effEdge', 'eff_edge_cm'), ('stance', 'stance_cm'), ('nose', 'nose_cm'), ('tail', 'tail_cm'),
]
mism = 0
for name in sorted(set(ns) & set(nd)):
    sa = {s['size']: s for s in ns[name]['sizes']}
    sd = {s['size']: s for s in nd[name]['sizes']}
    if set(sa) != set(sd):
        print('尺码清单不同:', name, 'specs独有', set(sa) - set(sd), 'data独有', set(sd) - set(sa)); mism += 1
    for k in sorted(set(sa) & set(sd)):
        for dj, sj in MAP:
            if sd[k].get(dj) != sa[k].get(sj):
                print('不一致:', name, k, dj, ': data.js=', repr(sd[k].get(dj)), ' PDF=', repr(sa[k].get(sj))); mism += 1
    # 型号级字段
    for dj, sj in [('audience', 'audience'), ('category', 'category'), ('isSplit', 'is_split'), ('isNew', 'is_new')]:
        if nd[name].get(dj) != ns[name].get(sj):
            print('不一致:', name, dj, ': data.js=', nd[name].get(dj), ' PDF=', ns[name].get(sj)); mism += 1
print('字段比对差异数:', mism)

# 物理一致性（全部 270 个尺码）
bad = []
for m in data:
    for s in m['sizes']:
        tag = m['name'] + ' ' + s['size']
        if None in (s['waist'], s['nose'], s['tail'], s['effEdge'], s['stance'], s['wMin']):
            bad.append((tag, '关键字段为 null'))
        if s['waist'] and s['nose'] and s['tail'] and not (s['waist'] < min(s['nose'], s['tail'])):
            bad.append((tag, '板腰不小于头尾'))
        if s['effEdge'] and s['len'] and s['effEdge'] >= s['len']:
            bad.append((tag, '有效边刃>=板长'))
        if s['stance'] and not (38 <= s['stance'] <= 68):
            bad.append((tag, '站距异常 ' + str(s['stance'])))
        if s['wMin'] is not None and s['wMax'] is not None and s['wMax'] and s['wMin'] > s['wMax']:
            bad.append((tag, '体重区间倒置'))
        if s['euMin'] is not None and s['euMax'] is not None and s['euMin'] > s['euMax']:
            bad.append((tag, '鞋码区间倒置'))
        if s['euMin'] is not None and not (30 <= s['euMin'] <= 48):
            bad.append((tag, 'EU 下限异常'))
        if s['usMin'] is not None and s['usMax'] is not None:
            us_ok = any(s['usMin'] <= e <= (s['usMax'] or 99) for e in [s['usMin']])
        if s['variant'] not in ('', 'W', 'N', 'UW'):
            bad.append((tag, '未知 variant ' + s['variant']))
        # 与 EU 对应的 US 粗校验：EU(巴黎点) -> mondo(cm) -> US 男码，容差 1.6
        if s['euMin'] is not None and s['usMin'] is not None:
            mondo = s['euMin'] * 2 / 3 - 1.5
            us_from_eu = 3 * (mondo / 2.54) - 23
            if abs(us_from_eu - s['usMin']) > 1.6:
                bad.append((tag, 'US/EU 下限不匹配 us=%s eu=%s(推算%.1f)' % (s['usMin'], s['euMin'], us_from_eu)))
print('物理一致性异常:', len(bad))
for t, r in bad[:25]:
    print('  ', t, '->', r)
