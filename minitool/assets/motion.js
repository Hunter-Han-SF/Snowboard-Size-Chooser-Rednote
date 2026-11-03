/* 装饰层独立于选板、问卷和分享逻辑；无循环、无网络或传感器。 */
(function () {
  "use strict";
  var body = document.body;
  var button = document.getElementById("motionToggle");
  var hero = document.getElementById("modelSection");
  if (!body || !button || !hero) return;

  var reduced = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var fine = window.matchMedia ? window.matchMedia("(hover: hover) and (pointer: fine)") : { matches: false };
  var paused = false, active = false, frame = 0, x = 0, y = 0;
  function reset() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    hero.style.setProperty("--scene-x", "0px");
    hero.style.setProperty("--scene-y", "0px");
  }
  function sync() {
    active = !paused && !reduced.matches && !document.hidden;
    body.classList[active ? "add" : "remove"]("motion-active");
    button.hidden = false;
    button.disabled = reduced.matches;
    button.textContent = reduced.matches ? "静态" : (paused ? "动效关" : "动效开");
    button.setAttribute("aria-pressed", String(!paused && !reduced.matches));
    button.setAttribute("title", reduced.matches ? "已遵循系统减少动态效果设置" : (paused ? "开启光影动效" : "暂停光影动效"));
    if (!active) reset();
  }
  button.addEventListener("click", function () { paused = !paused; sync(); });
  document.addEventListener("visibilitychange", sync);
  if (reduced.addEventListener) reduced.addEventListener("change", sync);
  else if (reduced.addListener) reduced.addListener(sync);

  hero.addEventListener("pointermove", function (event) {
    if (!active || !fine.matches || event.pointerType !== "mouse" || !window.requestAnimationFrame) return;
    var rect = hero.getBoundingClientRect();
    x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)) * 5;
    y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) * 4;
    if (!frame) frame = window.requestAnimationFrame(function () {
      frame = 0;
      hero.style.setProperty("--scene-x", x.toFixed(2) + "px");
      hero.style.setProperty("--scene-y", y.toFixed(2) + "px");
    });
  });
  hero.addEventListener("pointerleave", reset);
  reset();
  sync();
}());
