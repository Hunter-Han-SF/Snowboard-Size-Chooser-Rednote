/* 独立装饰层的行为回归；无需浏览器依赖。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../minitool/assets/motion.js'), 'utf8');
function boot({reduce = false, fine = true, legacy = false} = {}) {
  function el() {
    const classes = new Set();
    return {hidden: true, attrs: {}, events: {}, styles: {}, textContent: '',
      classList: {add: v => classes.add(v), remove: v => classes.delete(v), contains: v => classes.has(v)},
      style: {setProperty(k, v) { this.owner.styles[k] = v; }},
      setAttribute(k, v) {this.attrs[k] = v;}, addEventListener(k, v) {this.events[k] = v;},
      getBoundingClientRect() {return {left: 0, top: 0, width: 400, height: 480};}};
  }
  const body = el(), button = el(), hero = el(); hero.style.owner = hero;
  const media = {matches: reduce};
  media[legacy ? 'addListener' : 'addEventListener'] = (...args) => {media.change = args[args.length - 1];};
  const document = {body, hidden: false, events: {}, getElementById: id => ({motionToggle: button, modelSection: hero})[id],
    addEventListener(k, v) {this.events[k] = v;}};
  let callback, cancelled = 0;
  const window = {matchMedia: q => q.indexOf('reduced') >= 0 ? media : {matches: fine},
    requestAnimationFrame: cb => {callback = cb; return 1;}, cancelAnimationFrame: () => {callback = null; cancelled++;}};
  vm.runInNewContext(source, {window, document});
  return {body, button, hero, document, media, flush: () => {if (callback) {const cb = callback; callback = null; cb();}}, cancelled: () => cancelled};
}
let tests = 0;
function test(name, fn) {fn(); tests++; console.log('PASS ' + name);}
test('默认启用，暂停/恢复不涉及业务状态', () => {
  const t = boot(); assert(t.body.classList.contains('motion-active')); assert.equal(t.button.hidden, false);
  t.button.events.click(); assert(!t.body.classList.contains('motion-active')); assert.equal(t.button.attrs['aria-pressed'], 'false');
  t.button.events.click(); assert(t.body.classList.contains('motion-active'));
});
test('减少动态效果优先，兼容旧版 MediaQueryList', () => {
  const t = boot({reduce: true, legacy: true}); assert(!t.body.classList.contains('motion-active')); assert(t.button.disabled);
  t.media.matches = false; t.media.change(); assert(t.body.classList.contains('motion-active')); assert(!t.button.disabled);
});
test('后台停播、恢复前台保留手动暂停', () => {
  const t = boot(); t.document.hidden = true; t.document.events.visibilitychange(); assert(!t.body.classList.contains('motion-active'));
  t.document.hidden = false; t.document.events.visibilitychange(); assert(t.body.classList.contains('motion-active'));
  t.button.events.click(); t.document.hidden = true; t.document.events.visibilitychange(); t.document.hidden = false; t.document.events.visibilitychange();
  assert(!t.body.classList.contains('motion-active'));
});
test('指针移动合并到单帧，离开和暂停清除位移', () => {
  const t = boot(); t.hero.events.pointermove({pointerType: 'mouse', clientX: 400, clientY: 480}); t.flush();
  assert.notEqual(t.hero.styles['--scene-x'], '0px');
  t.hero.events.pointerleave(); assert.equal(t.hero.styles['--scene-x'], '0px');
  t.hero.events.pointermove({pointerType: 'mouse', clientX: 400, clientY: 480}); t.button.events.click(); t.flush();
  assert.equal(t.hero.styles['--scene-x'], '0px'); assert(t.cancelled() > 0);
});
test('触摸和粗指针不触发视差', () => {
  const t = boot({fine: false}); t.hero.events.pointermove({pointerType: 'touch', clientX: 400, clientY: 480}); t.flush();
  assert.equal(t.hero.styles['--scene-x'], '0px');
});
console.log(tests + ' motion checks passed');
