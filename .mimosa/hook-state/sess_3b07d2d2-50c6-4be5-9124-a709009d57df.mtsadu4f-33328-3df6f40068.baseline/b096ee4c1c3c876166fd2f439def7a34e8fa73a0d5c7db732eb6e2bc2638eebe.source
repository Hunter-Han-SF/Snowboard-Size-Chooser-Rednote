/* 回归测试：对照 Jones 官方尺码指南验证 main.js 匹配算法。
   前置: node tmp/gen_extract.js。用法: node tmp/test_algo.js */
const path = require('path');
const os = require('os');
module.paths.push(path.join(os.tmpdir(), 'node_modules'));
const { minWaistForEU, scoreSizes, pickBest } = require('jones_algo_extract');

const DATA = globalThis.JONES_DATA;

function findModel(n) { return DATA.find(m => m.name === n); }
function run(name, W, EU, H, pref) {
  const m = findModel(name);
  const scored = scoreSizes(m, W, EU);
  const ranked = pickBest(scored, W, EU, H || 175, pref || 'none', m);
  const balanced = pickBest(scored, W, EU, H || 175, 'none', m)[0];
  return {
    best: ranked[0].s.size,
    variant: ranked[0].s.variant,
    waist: ranked[0].s.waist,
    widthStatus: ranked.widthStatus,
    prefAdjusted: (pref || 'none') !== 'none' && ranked[0].s.size !== balanced.s.size,
  };
}

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + label + '  =>  ' + JSON.stringify(got) + (ok ? '' : '   (期望 ' + JSON.stringify(want) + ')'));
}

/* 1. minWaistForEU 对照官方宽度表 */
console.log('----- 1) minWaistForEU vs 官方表 -----');
const OFFICIAL = { 44: 25.9, 44.5: 26.1, 45: 26.3, 45.5: 26.5, 46: 26.7, 46.5: 26.7,
                   47: 26.9, 47.5: 27.1, 48: 27.3, 48.5: 27.5, 49: 27.8, 49.5: 27.8, 50: 27.8 };
Object.keys(OFFICIAL).map(Number).sort((a, b) => a - b).forEach(eu => {
  eq('EU ' + eu + ' 最小板腰', Math.round(minWaistForEU(eu) * 100) / 100, OFFICIAL[eu]);
});
eq('EU < 44 不启用宽度校验', minWaistForEU(43.5), null);
eq('EU null 不启用宽度校验', minWaistForEU(null), null);

/* 2. Flagship 场景 */
console.log('\n----- 2) Men’s Flagship -----');
let r = run('Men’s Flagship', 70, null, 175, 'none');
eq('70kg 无鞋码 => 中间档 154', r.best, '154');
eq('70kg 无鞋码 灵活优先 => 151', run('Men’s Flagship', 70, null, 175, 'short').best, '151');
eq('70kg 无鞋码 稳定优先 => 158', run('Men’s Flagship', 70, null, 175, 'long').best, '158');
r = run('Men’s Flagship', 70, 45, 175, 'none');
eq('70kg EU45 => 159W', [r.best, r.widthStatus], ['159W', 'ok']);
r = run('Men’s Flagship', 70, 46, 175, 'none');
eq('70kg EU46(体重档无26.7) => 159W + fallback', [r.best, r.widthStatus], ['159W', 'fallback']);
eq('80kg EU44 => 167', run('Men’s Flagship', 80, 44, 180, 'none').best, '167');
eq('50kg 低于全部区间 => 151', run('Men’s Flagship', 50, null, 165, 'none').best, '151');
eq('110kg 超出全部区间无鞋码 => 172', run('Men’s Flagship', 110, null, 190, 'none').best, '172');

/* 3. Hovercraft 2.0 */
console.log('\n----- 3) Hovercraft 2.0 -----');
r = run('Hovercraft 2.0', 65, 44.5, 172, 'none');
eq('65kg EU44.5 => 156 原生宽板', [r.best, r.widthStatus], ['156', 'ok']);
r = run('Hovercraft 2.0', 80, 46, 180, 'none');
eq('80kg EU46 => 160', [r.best, r.widthStatus], ['160', 'ok']);
r = run('Hovercraft 2.0', 80, 46.5, 180, 'none');
eq('80kg EU46.5(官方26.7) => 160', [r.best, r.widthStatus], ['160', 'ok']);

/* 4. Freecarver 6000s */
console.log('\n----- 4) Freecarver 6000s -----');
eq('70kg 无鞋码 => 排除 N 取中 154', run('Freecarver 6000s', 70, null, 175, 'none').best, '154');
eq('70kg EU38 => N 版取中 154N', run('Freecarver 6000s', 70, 38, 175, 'none').best, '154N');
eq('70kg EU45 => 154', run('Freecarver 6000s', 70, 45, 175, 'none').best, '154');

/* 5. 儿童 / 身高轻推 */
console.log('\n----- 5) 儿童与身高 -----');
eq('儿童 35kg EU36 => 127', run('Flagship Junior', 35, 36, 140, 'none').best, '127');
eq('高个儿童(160cm)不做身高修正', run('Flagship Junior', 35, 36, 160, 'none').best, '127');
eq('儿童 pref=long 仅偏好移动一档', run('Flagship Junior', 35, 36, 160, 'long').best, '132');
eq('160cm/78kg 矮壮 => 164 轻推短一档 161', run('Men’s Flagship', 78, null, 160, 'none').best, '161');
eq('195cm/74kg 高瘦 => 154 轻推长一档 158', run('Men’s Flagship', 74, 41, 195, 'none').best, '158');

/* 6. 用户案例回归 */
console.log('\n----- 6) 用户案例 -----');
eq('180/80/EU41.5 Hovercraft => 156', run('Hovercraft 2.0', 80, 41.5, 180, 'none').best, '156');
eq('175/68/EU40.5 Flagship 均衡 => 154', run('Men’s Flagship', 68, 40.5, 175, 'none').best, '154');
eq('同上 稳定 => 158', run('Men’s Flagship', 68, 40.5, 175, 'long').best, '158');
eq('175/77/EU44.5 均衡 => 159W', run('Men’s Flagship', 77, 44.5, 175, 'none').best, '159W');
eq('同上 稳定 => 162W', run('Men’s Flagship', 77, 44.5, 175, 'long').best, '162W');
eq('183/88.5/EU44.5 => 165W', run('Men’s Flagship', 88.5, 44.5, 183, 'none').best, '165W');
eq('163/50/EU36.5 Dream Weaver => 142', run('Women’s Dream Weaver 2.0', 50, 36.5, 163, 'none').best, '142');
eq('同上 稳定 => 145', run('Women’s Dream Weaver 2.0', 50, 36.5, 163, 'long').best, '145');
eq('185/95/EU46 Mountain Twin => 165W', run('Men’s Mountain Twin', 95, 46, 185, 'none').best, '165W');
eq('同上 稳定 => 168W', run('Men’s Mountain Twin', 95, 46, 185, 'long').best, '168W');

/* 6.5 Howler 小脚 + EU44 空档 */
console.log('\n----- 6.5) Howler / EU44 空档 -----');
eq('180/80/EU42.5 Howler 均衡 => 158', run('Men’s Howler', 80, 42.5, 180, 'none').best, '158');
eq('同上 稳定 => 161', run('Men’s Howler', 80, 42.5, 180, 'long').best, '161');
eq('同上 灵活 => 155', run('Men’s Howler', 80, 42.5, 180, 'short').best, '155');
r = run('Men’s Flagship', 66, 44, 175, 'none');
eq('66kg/EU44 => 宽度表优先 => 156W', [r.best, r.widthStatus], ['156W', 'ok']);

/* 7. 手动改码 widthOk（复刻 match() 逻辑） */
console.log('\n----- 7) 手动改码 widthOk -----');
(function () {
  const m = findModel('Men’s Flagship');
  const scored = scoreSizes(m, 70, 45);
  const ranked = pickBest(scored, 70, 45, 175, 'none', m);
  let best = ranked[0];
  for (let k = 0; k < ranked.length; k++) if (ranked[k].s.size === '158') { best = ranked[k]; break; }
  const widthMin = minWaistForEU(45);
  eq('自动 159W widthOk=true', widthMin === null || ranked[0].s.waist + 0.05 >= widthMin, true);
  eq('手动 158(24.9) widthOk=false', widthMin === null || best.s.waist + 0.05 >= widthMin, false);
})();

/* 7.5 守卫扫描 */
console.log('\n----- 7.5) 守卫扫描 -----');
(function () {
  let smallFootWide = 0, eu465 = 0;
  DATA.forEach(m => {
    [40, 41, 41.5, 42, 42.5, 43, 43.5].forEach(EU => {
      for (let W = 30; W <= 120; W++) {
        const res = run(m.name, W, EU, 175, 'none');
        if (res.variant === 'W' || res.variant === 'UW') {
          const scored = scoreSizes(m, W, EU);
          const hasRegular = scored.some(x => x.wIn && x.euIn && x.s.variant !== 'W' && x.s.variant !== 'UW');
          if (hasRegular) smallFootWide++;
        }
      }
    });
    for (let W = 30; W <= 120; W++) {
      if (run(m.name, W, 46.5, 175, 'none').best !== run(m.name, W, 46, 175, 'none').best) eu465++;
    }
  });
  eq('EU<44 且有常规尺码时仍推荐 W/UW', smallFootWide, 0);
  eq('EU46.5 插值偏差影响组合', eu465, 0);
})();

console.log('\n结果: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
