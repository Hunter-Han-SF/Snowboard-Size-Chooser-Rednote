/* Jones 雪板尺码助手 —— 主逻辑（ES2017 / Chrome 61 基线） */
(function () {
  "use strict";

  var DATA = window.JONES_DATA || [];
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    audience: "全部",
    model: null,          // 当前选中型号对象
    pref: "none",         // 滑行偏好：尺寸推荐唯一依据（默认均衡）
    prefManual: false,    // 用户是否手动选过偏好（手动选择后风格不再覆盖）
    style: null,          // 滑行风格 key（仅辅助选偏好，不影响尺码）
    stanceDir: "regular", // 站姿脚位：regular=左脚前 / goofy=右脚前
    bodyTouched: false,   // 用户是否手动调整过身体数据（未调整时随人群切换平均数据）
    manualSize: null,     // 结果页手动选择的尺码（null=按推荐）
    lastResult: null
  };

  // 各人群的平均身体数据 [身高cm, 体重kg]（女生/儿童与男款/通用区分）
  var BODY_DEFAULTS = {
    "全部": [175, 70], "男款": [175, 70], "通用": [175, 70],
    "女款": [163, 55], "儿童": [135, 35]
  };

  var PREF_NAME = { none: "均衡", short: "灵活优先", long: "稳定优先" };

  /* 滑行风格 -> 建议偏好（仅辅助自动选偏好，不影响尺码） */
  var STYLES = {
    carve:     { label: "刻滑",       pref: "long"  },
    freeride:  { label: "道外",       pref: "long"  },
    piste:     { label: "道内",       pref: "none"  },
    amfs:      { label: "全山自由式", pref: "none"  },
    freestyle: { label: "自由式",     pref: "short" },
    park:      { label: "公园",       pref: "short" },
    butter:    { label: "平花",       pref: "short" },
  };

  /* ---------- 站姿角度与出界估算 ---------- */
  function fmtAngle(a) {
    if (a === null || a === undefined || isNaN(a)) return "—";
    return (a > 0 ? "+" : "") + a + "°";
  }
  // 鞋壳尺寸估算（cm）：mondo 脚长 + 鞋壳余量；0.88 为鞋头/鞋跟圆角修正
  function bootDims(EU) {
    var mondo = EU * 2 / 3 - 1.5;
    return {
      len: (mondo + 1.5) * 0.88,    // 有效鞋底长度（投影计算用）
      wid: mondo * 0.36 + 0.7       // 鞋底宽度
    };
  }
  // 单只脚在给定角度下横跨板面的投影宽 − 腰宽 = 总出界量（cm，>0 即出界）
  // 按板腰（板最窄处）计算，与官方鞋码区间口径一致，代表最大出界情况
  function footOverhang(size, EU, angle) {
    var d = bootDims(EU);
    var rad = Math.abs(angle) * Math.PI / 180;
    var proj = d.len * Math.cos(rad) + d.wid * Math.sin(rad);
    return proj - size.waist;
  }
  // 距板中心 xCm 处的实际板宽：由板腰向板头/板尾最宽点做二次侧切插值
  // （固定器孔位远离板腰，站位处板宽大于腰宽，是更接近真实的参考值）
  function boardWidthAt(size, xCm) {
    var tip = xCm >= 0 ? size.nose : size.tail;
    var t = Math.min(1, Math.abs(xCm) / (size.len / 2));
    return size.waist + (tip - size.waist) * t * t;
  }
  function overhangVerdict(maxOh) {
    if (maxOh <= 1) return { cls: "ok", text: "贴边非常干净，刻滑也不怕蹭雪" };
    if (maxOh <= 2) return { cls: "ok", text: "出界在正常范围，操控与边刃抓地均衡" };
    if (maxOh <= 3) return { cls: "warn", text: "出界偏大，立刃时脚趾/脚跟易蹭雪，建议考虑加宽版（W / Big Horn）" };
    return { cls: "bad", text: "出界明显，强烈建议选择 W 加宽 / Big Horn 尺码" };
  }

  /* ---------- 工具 ---------- */
  function fmt(n) {
    if (n === null || n === undefined) return "—";
    return Math.round(n * 10) / 10;
  }
  function wRangeText(s) {
    return fmt(s.wMin) + "–" + fmt(s.wMax) + (s.wOpen ? "+" : "") + " kg";
  }
  function euRangeText(s) {
    if (s.euMin === null) return "—";
    var open = s.euMax === null;
    // 官方目录 Hovercraft 2.0 144 的鞋码下限印作 0（官网亦然），按“无下限”显示
    if (s.euMin === 0) return "EU ≤" + fmt(s.euMax);
    return open ? "EU " + fmt(s.euMin) + "+"
                : "EU " + fmt(s.euMin) + "–" + fmt(s.euMax);
  }
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("is-show");
    clearTimeout(toast._tid);
    toast._tid = setTimeout(function () { t.classList.remove("is-show"); }, 2200);
  }
  function variantLabel(v) {
    if (v === "W") return "加宽版";
    if (v === "UW") return "超宽版";
    if (v === "N") return "窄版";
    return "";
  }

  /* ---------- 第 1 步：型号列表 ---------- */
  function renderModelSelect() {
    var sel = $("modelSelect");
    sel.innerHTML = "";
    var cats = window.JONES_CATEGORIES || [];
    var kids = [], splits = [];
    // 普通板按分类分组（儿童款、分离板除外，另组放后面）
    cats.forEach(function (cat) {
      var models = DATA.filter(function (m) {
        return m.category === cat && !m.isSplit && m.audience !== "儿童" &&
          (state.audience === "全部" || m.audience === state.audience);
      });
      if (!models.length) return;
      var group = document.createElement("optgroup");
      group.label = cat;
      models.forEach(function (m) {
        group.appendChild(makeOption(m));
      });
      sel.appendChild(group);
    });
    // 儿童款 / 分离板单独收集（不依赖上方分类组是否为空，儿童过滤下也能列出）
    DATA.forEach(function (m) {
      if (state.audience !== "全部" && m.audience !== state.audience) return;
      if (m.audience === "儿童" && !m.isSplit) kids.push(m);
      else if (m.isSplit) splits.push(m);
    });
    if (kids.length) {
      var kg = document.createElement("optgroup");
      kg.label = "儿童系列";
      kids.forEach(function (m) { kg.appendChild(makeOption(m)); });
      sel.appendChild(kg);
    }
    if (splits.length) {
      var sg = document.createElement("optgroup");
      sg.label = "分离板（野雪进山）";
      splits.forEach(function (m) { sg.appendChild(makeOption(m)); });
      sel.appendChild(sg);
    }
    // 默认选中：全部 / 男款默认男款 Howler，女款默认女款 Howler，其余选第一个
    if (sel.options.length) {
      sel.selectedIndex = 0;
      var preferred = { "全部": "Men’s Howler", "男款": "Men’s Howler", "女款": "Women’s Howler" }[state.audience];
      if (preferred) {
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === preferred) { sel.selectedIndex = i; break; }
        }
      }
      state.model = findModel(sel.value);
      state.manualSize = null;          // 切人群换了默认型号，手动选码失效
    }
    renderModelMeta();
  }

  function makeOption(m) {
    var opt = document.createElement("option");
    opt.value = m.name;
    var label = m.name;
    if (m.isSplit) label += " ·分离板";
    if (m.isNew) label += " ·新";
    opt.textContent = label;
    return opt;
  }

  function findModel(name) {
    for (var i = 0; i < DATA.length; i++) {
      if (DATA[i].name === name) return DATA[i];
    }
    return null;
  }

  function renderModelMeta() {
    var el = $("modelMeta");
    if (!state.model) { el.textContent = ""; return; }
    var m = state.model;
    var sizes = m.sizes.map(function (s) { return s.size; }).join(" / ");
    el.innerHTML = "";
    el.appendChild(document.createTextNode("可选尺码 "));
    var b = document.createElement("b");
    b.textContent = sizes;
    el.appendChild(b);
    renderBoardPreview(m);
  }

  /* ---------- 型号预览卡 ---------- */
  function renderBoardPreview(m) {
    var pv = $("boardPreview");
    if (!pv || !m) return;
    var img = $("bpImg");
    if (m.img) {
      img.style.display = "";
      img.src = m.img;
      img.onerror = function () { img.style.display = "none"; };
    } else {
      img.style.display = "none";
    }
    $("bpName").textContent = m.name;

    // 官方标语（短）与一句话定位（长）分行展示
    var tl = $("bpTagline");
    tl.textContent = m.tag || "";
    tl.style.display = m.tag ? "" : "none";
    var pt = $("bpPitch");
    pt.textContent = m.pitch || "";
    pt.classList.toggle("is-hide", !m.pitch);

    var tags = $("bpTags");
    tags.innerHTML = "";
    var items = [
      { t: m.category, hot: false },
      { t: m.audience, hot: false },
      { t: m.isSplit ? "分离板" : "", hot: false },
      { t: m.isNew ? "26-27 新品" : "", hot: true },
    ];
    items.forEach(function (it) {
      if (!it.t) return;
      var el = document.createElement("span");
      el.className = "bp-tag" + (it.hot ? " hot" : "");
      el.textContent = it.t;
      tags.appendChild(el);
    });

    // 板型 / 轮廓 / 个性硬度 → 规格行（长文本不适合胶囊）
    var sp = $("bpSpecs");
    sp.innerHTML = "";
    [["板型", m.shape], ["轮廓", m.profile], ["个性/硬度", m.character]].forEach(function (kv) {
      if (!kv[1]) return;
      var row = document.createElement("div");
      row.className = "bp-spec";
      var k = document.createElement("span");
      k.className = "bps-k"; k.textContent = kv[0];
      var v = document.createElement("span");
      v.className = "bps-v"; v.textContent = kv[1];
      row.appendChild(k); row.appendChild(v);
      sp.appendChild(row);
    });
    sp.classList.toggle("is-hide", !sp.children.length);

    // 官方地形三维打分（全山/粉雪/自由式，分离板为深粉/陡坡峡湾/登滑表现）
    var sc = $("bpScores");
    sc.innerHTML = "";
    (m.scores || []).forEach(function (s) {
      var row = document.createElement("div");
      row.className = "bp-score";
      var lb = document.createElement("span");
      lb.className = "bs-label"; lb.textContent = s.l;
      var tr = document.createElement("div");
      tr.className = "bs-track";
      var fl = document.createElement("div");
      fl.className = "bs-fill"; fl.style.width = "0%";
      tr.appendChild(fl);
      var vl = document.createElement("span");
      vl.className = "bs-val"; vl.textContent = s.v + "/10";
      row.appendChild(lb); row.appendChild(tr); row.appendChild(vl);
      sc.appendChild(row);
      // 入场后过渡到真实宽度
      setTimeout(function () { fl.style.width = (s.v * 10) + "%"; }, 30);
    });
    sc.classList.toggle("is-hide", !(m.scores || []).length);

    // 官方介绍（缺失时回退到内置简介）
    $("bpDesc").textContent = m.intro || m.desc || "";

    var bl = $("bpBullets");
    bl.innerHTML = "";
    (m.bullets || []).forEach(function (b) {
      var el = document.createElement("div");
      el.className = "bp-bullet";
      el.textContent = b;
      bl.appendChild(el);
    });
    bl.classList.toggle("is-hide", !(m.bullets || []).length);

    // 重启入场动画
    pv.classList.remove("is-in");
    void pv.offsetWidth;
    pv.classList.add("is-in");
  }

  /* ---------- 输入控件 ---------- */
  function bindSlider(inputId, valId) {
    var input = $(inputId), val = $(valId);
    function paint() {
      val.textContent = input.value;
      var pct = (input.value - input.min) / (input.max - input.min) * 100;
      // 用 CSS 变量传给 ::-webkit-slider-runnable-track 伪元素
      input.style.setProperty("--fill", pct + "%");
    }
    input.__paint = paint;
    input.addEventListener("input", function () {
      state.bodyTouched = true;   // 手动调整后不再随人群联动
      paint();
    });
    paint();
  }

  function bindChips() {
    $("audienceChips").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".chip") : null;
      if (!btn) return;
      var chips = $("audienceChips").querySelectorAll(".chip");
      for (var i = 0; i < chips.length; i++) chips[i].classList.remove("is-on");
      btn.classList.add("is-on");
      state.audience = btn.getAttribute("data-aud");
      renderModelSelect();
      // 未手动调整过身体数据时，切到该人群的平均身高体重
      if (!state.bodyTouched && BODY_DEFAULTS[state.audience]) {
        var bd = BODY_DEFAULTS[state.audience];
        $("heightInput").value = bd[0];
        $("weightInput").value = bd[1];
        $("heightInput").__paint();
        $("weightInput").__paint();
      }
    });
  }

  var THEME = { none: "theme-bal", short: "theme-flex", long: "theme-stab" };

  function setPrefUI(pref) {
    var prefs = $("prefGrid").querySelectorAll(".pref");
    for (var i = 0; i < prefs.length; i++) {
      prefs[i].classList.toggle("is-on", prefs[i].getAttribute("data-pref") === pref);
    }
    // 主题跟随偏好：均衡蓝 / 灵活绿 / 稳定红
    var b = document.body;
    b.classList.remove("theme-bal", "theme-flex", "theme-stab");
    b.classList.add(THEME[pref] || "theme-bal");
  }

  function bindPrefs() {
    $("prefGrid").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".pref") : null;
      if (!btn) return;
      state.pref = btn.getAttribute("data-pref");
      state.prefManual = true;           // 手动选择后，风格只提示建议、不再覆盖
      setPrefUI(state.pref);
    });
  }

  function bindStyles() {
    var DEF_HINT = "选风格自动匹配上方偏好；尺码始终以滑行偏好为准（默认均衡）";
    $("styleChips").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".schip") : null;
      if (!btn) return;
      var key = btn.getAttribute("data-style");
      if (state.style === key) {           // 再次点击取消
        state.style = null;
        btn.classList.remove("is-on");
        $("styleHint").textContent = DEF_HINT;
        return;
      }
      var chips = $("styleChips").querySelectorAll(".schip");
      for (var i = 0; i < chips.length; i++) chips[i].classList.remove("is-on");
      btn.classList.add("is-on");
      state.style = key;
      var st = STYLES[key];
      if (!state.prefManual) {
        state.pref = st.pref;              // 风格辅助：自动匹配偏好
        setPrefUI(state.pref);
        $("styleHint").textContent = st.label + " · 已自动匹配「" + PREF_NAME[st.pref] + "」，可手动改选";
      } else {
        $("styleHint").textContent = st.label + " · 通常匹配「" + PREF_NAME[st.pref] +
          "」，已保留你选择的「" + PREF_NAME[state.pref] + "」（以偏好为准）";
      }
    });
  }

  function buildBootSelect() {
    var sel = $("bootSelect");
    for (var eu = 26; eu <= 50; eu += 0.5) {
      var opt = document.createElement("option");
      // EU 码（巴黎点制）适合脚长 ≈ 码数 × 2/3 − 1.5cm，按 5mm 取整为 Mondopoint 内长
      var mm = Math.round((eu * 2 / 3 - 1.5) * 2) * 5;
      opt.value = eu;
      opt.textContent = "EU " + fmt(eu) + " · 内长 " + mm + " mm";
      sel.appendChild(opt);
    }
    sel.addEventListener("change", syncBootPlaceholder);
    syncBootPlaceholder();
  }

  function syncBootPlaceholder() {
    var sel = $("bootSelect");
    if (sel.value) sel.classList.remove("is-placeholder");
    else sel.classList.add("is-placeholder");
  }

  /* ---------- 站姿角度控件 ---------- */
  function buildStanceSelects() {
    var fa = $("frontAngle"), ba = $("backAngle");
    function fill(sel, lo, hi) {
      for (var a = lo; a <= hi; a += 3) {
        var opt = document.createElement("option");
        opt.value = a;
        opt.textContent = fmtAngle(a);
        sel.appendChild(opt);
      }
      sel.addEventListener("change", function () {
        sel.classList.toggle("is-placeholder", !sel.value);
        clearPresetHighlight();
      });
    }
    fill(fa, -30, 60);
    fill(ba, -30, 60);   // 一顺站姿后脚也可到 +60
    // 左脚前 / 右脚前：右脚前时前后脚两栏镜像（前脚在右）
    $("stanceDir").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".dt-btn") : null;
      if (!btn) return;
      state.stanceDir = btn.getAttribute("data-dir");
      var bs = $("stanceDir").querySelectorAll(".dt-btn");
      for (var i = 0; i < bs.length; i++) bs[i].classList.toggle("is-on", bs[i] === btn);
      $("stanceGrid").classList.toggle("is-goofy", state.stanceDir === "goofy");
    });
    $("stancePresets").addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".chip") : null;
      if (!btn) return;
      fa.value = btn.getAttribute("data-f");
      ba.value = btn.getAttribute("data-b");
      fa.classList.remove("is-placeholder");
      ba.classList.remove("is-placeholder");
      markPreset(btn);
    });
  }
  function markPreset(btn) {
    var chips = $("stancePresets").querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) chips[i].classList.remove("is-on");
    if (btn) btn.classList.add("is-on");
  }
  function clearPresetHighlight() { markPreset(null); }
  function readAngles() {
    var fa = parseFloat($("frontAngle").value);
    var ba = parseFloat($("backAngle").value);
    var ok = !isNaN(fa) && !isNaN(ba);
    return { fa: ok ? fa : null, ba: ok ? ba : null, ok: ok };
  }

  /* ---------- 匹配算法 ---------- */
  function rangeContains(value, min, max, open) {
    if (min === null || min === undefined || value === null || value === undefined) return false;
    return value >= min && (open || max === null || max === undefined || value <= max);
  }

  function rangeGap(value, min, max, open) {
    if (min === null || min === undefined || value === null || value === undefined) return 999;
    if (value < min) return min - value;
    if (!open && max !== null && max !== undefined && value > max) return value - max;
    return 0;
  }

  // Jones 官方宽度表：EU 44 以上开始用板腰宽度校验大脚，数值按相邻档位线性插值。
  // 官方表中 EU 46 与 46.5 同属 US 12 行（最小板腰均为 26.7），46.5 需单独列点，
  // 否则 46→47 插值会得到 26.8，把 26.7 板腰的尺码错误排除。
  // 这只是宽度下限，不把 W / UW 后缀当成长度排序依据。
  function minWaistForEU(EU) {
    if (!EU || EU < 44) return null;
    var points = [
      [44, 25.9], [44.5, 26.1], [45, 26.3], [45.5, 26.5],
      [46, 26.7], [46.5, 26.7], [47, 26.9], [47.5, 27.1],
      [48, 27.3], [48.5, 27.5], [49, 27.8]
    ];
    if (EU <= points[0][0]) return points[0][1];
    if (EU >= points[points.length - 1][0]) return points[points.length - 1][1];
    for (var i = 1; i < points.length; i++) {
      if (EU <= points[i][0]) {
        var x0 = points[i - 1][0], y0 = points[i - 1][1];
        var x1 = points[i][0], y1 = points[i][1];
        return y0 + (y1 - y0) * (EU - x0) / (x1 - x0);
      }
    }
    return points[points.length - 1][1];
  }

  function scoreSizes(model, W, EU) {
    var minWaist = minWaistForEU(EU);
    return model.sizes.map(function (s) {
      var wIn = rangeContains(W, s.wMin, s.wMax, s.wOpen);
      var wGap = rangeGap(W, s.wMin, s.wMax, s.wOpen);
      var wScore = wIn ? 100 : Math.max(0, 100 - wGap * 12);
      var euScore = 0;
      var euIn = true;
      var euGap = 0;
      if (EU !== null && EU !== undefined) {
        euIn = rangeContains(EU, s.euMin, s.euMax, s.euMax === null);
        euGap = rangeGap(EU, s.euMin, s.euMax, s.euMax === null);
        if (euIn) {
          euScore = 40;
        } else if (s.euMin !== null) {
          euScore = Math.max(0, 40 - euGap * 10);
        }
      }
      var widthGap = minWaist === null ? 0 : Math.max(0, minWaist - s.waist);
      // The official chart is expressed in 0.1 cm increments. Keep only a
      // tiny floating-point tolerance; a 26.0 cm waist does not satisfy a
      // 26.1 cm minimum recommendation for EU 44.5 boots.
      var widthIn = minWaist === null || widthGap <= 0.05;
      return { s: s, total: wScore + euScore, wIn: wIn, wGap: wGap,
               euIn: euIn, euGap: euGap, widthIn: widthIn, widthGap: widthGap };
    });
  }

  function candidatePool(scored, W, EU) {
    var pool = scored.filter(function (r) { return r.wIn; });
    var widthStatus = "ok";

    // 体重不落在任何尺码内时，先取离官方区间最近的一组。
    if (!pool.length) {
      var minGap = Math.min.apply(null, scored.map(function (r) { return r.wGap; }));
      pool = scored.filter(function (r) { return r.wGap === minGap; });
    }

    // 体重档原始候选（未做鞋码筛选），供板腰空档回退使用
    var wPool = pool;

    if (EU !== null && EU !== undefined) {
      // 在体重合适的尺码中，优先选择官方鞋码覆盖的尺码。
      var bootFit = pool.filter(function (r) { return r.euIn; });
      if (bootFit.length) pool = bootFit;

      // EU 44 以上再做板腰下限校验，避免“大脚加分”把人推到最长普通尺码。
      var minWaist = minWaistForEU(EU);
      if (minWaist !== null) {
        var widthFit = pool.filter(function (r) { return r.widthIn; });
        if (widthFit.length) pool = widthFit;
        else {
          // 鞋码覆盖与板腰下限没有交集时，回看体重档原始候选里是否有板腰
          // 达标、只是目录鞋码下限略高的尺码（EU 44 与 W 版 euMin 44.5 之间
          // 存在官方宽度表 25.9 下限的空档）——宽度表是官方指南的硬性下限，
          // 优先级高于目录鞋码区间；其中仍优先鞋码能覆盖的。
          var wideAlt = wPool.filter(function (r) { return r.widthIn; });
          if (wideAlt.length) {
            var wideBoot = wideAlt.filter(function (r) { return r.euIn; });
            pool = wideBoot.length ? wideBoot : wideAlt;
          } else {
            // 体重档内确实没有板腰达标的尺码：不跨到明显超重的长板，在当前
            // 体重可用尺码中选最宽的一档，并在结果页明确提示存在取舍。
            var maxWaist = Math.max.apply(null, pool.map(function (r) { return r.s.waist; }));
            pool = pool.filter(function (r) { return r.s.waist >= maxWaist - 0.05; });
            widthStatus = "fallback";
          }
        }
      } else {
        // EU 44 以下官方建议常规宽度即可。目录里部分 W 版（如 Howler 157W）
        // 的最佳鞋码下限很低，不能仅凭鞋码区间把小脚推向加宽版；只有当
        // 体重档内没有常规尺码时才保留 W/UW。窄版 N 仍由鞋码区间约束。
        var regular = pool.filter(function (r) { return r.s.variant !== "W" && r.s.variant !== "UW"; });
        if (regular.length) pool = regular;
      }
    } else {
      // 没有鞋码时，不主动推荐 W/UW；但保留无后缀的原生宽板（如 Hovercraft 156）。
      var regular = pool.filter(function (r) { return !r.s.variant; });
      if (regular.length) pool = regular;
    }

    pool.widthStatus = widthStatus;
    return pool;
  }

  function heightAdjustedIndex(pool, index, H, model, W) {
    // Jones 的尺码原则仍以体重为主；身高只在成人候选明显偏离常规身高比例时轻推一档。
    // 儿童不使用成人的 H-25/H-15 经验范围，避免把儿童板推得过长。
    if (!H || !model || model.audience === "儿童" || pool.length < 2) return index;
    var s = pool[index].s;
    var lo = H - 25, hi = H - 15;
    var weightPos = (s.wMax > s.wMin) ? (W - s.wMin) / (s.wMax - s.wMin) : 0.5;
    if (s.len > hi && weightPos < 0.35) return Math.max(0, index - 1);
    if (s.len < lo && weightPos > 0.35) return Math.min(pool.length - 1, index + 1);
    return index;
  }

  function pickBest(scored, W, EU, H, pref, model) {
    var sourcePool = candidatePool(scored, W, EU);
    var widthStatus = sourcePool.widthStatus || "ok";
    var pool = sourcePool.slice();
    pool.sort(function (a, b) { return a.s.len - b.s.len; });

    // 官方建议：多个尺码覆盖体重时取中间；偏好只向短/长相邻移动一档。
    var mid = Math.floor((pool.length - 1) / 2);
    var index = mid;
    if (pref === "short") index = Math.max(0, mid - 1);
    if (pref === "long") index = Math.min(pool.length - 1, mid + 1);
    index = heightAdjustedIndex(pool, index, H, model, W);

    var chosen = pool[index];
    var ranked = [chosen];
    var rest = pool.slice();
    rest.splice(index, 1);
    rest.sort(function (a, b) {
      var da = Math.abs(a.s.len - chosen.s.len);
      var db = Math.abs(b.s.len - chosen.s.len);
      if (da !== db) return da - db;
      return a.s.len - b.s.len;
    });
    ranked = ranked.concat(rest);

    // 保留不在当前合格池中的尺码用于结果页备选展示。
    var inPool = new Set(pool.map(function (r) { return r.s.size; }));
    var outside = scored.filter(function (r) { return !inPool.has(r.s.size); });
    outside.sort(function (a, b) { return b.total - a.total || a.s.len - b.s.len; });
    var result = ranked.concat(outside);
    result.widthStatus = widthStatus;
    return result;
  }

  function match() {
    var W = parseFloat($("weightInput").value);
    var H = parseFloat($("heightInput").value);
    var euVal = $("bootSelect").value;
    var EU = euVal ? parseFloat(euVal) : null;

    if (!state.model) { showError("请先选择雪板型号"); return null; }
    hideError();

    var scored = scoreSizes(state.model, W, EU);
    var ranked = pickBest(scored, W, EU, H, state.pref, state.model);
    var best = ranked[0];
    var balanced = pickBest(scored, W, EU, H, "none", state.model)[0];
    var prefAdjusted = state.pref !== "none" && best.s.size !== balanced.s.size;
    var widthStatus = ranked.widthStatus || "ok";

    // 手动选码：用户在结果页点选的尺码优先于推荐结果
    var manual = false;
    var autoSize = best.s.size;
    if (state.manualSize) {
      for (var k = 0; k < ranked.length; k++) {
        if (ranked[k].s.size === state.manualSize) {
          best = ranked[k];
          manual = true;
          prefAdjusted = false;
          break;
        }
      }
    }

    // 大脚宽度校验按当前展示的尺码实时判定（手动改码后同样生效），
    // widthStatus 仅保留为「该型号体重档内是否存在完全匹配」的池级信号
    var widthMin = minWaistForEU(EU);
    var widthOk = widthMin === null || best.s.waist + 0.05 >= widthMin;

    // 备选：不同长度的次优项
    var alts = [];
    for (var i = 0; i < ranked.length && alts.length < 2; i++) {
      if (ranked[i].s.len !== best.s.len) alts.push(ranked[i]);
    }
    // 出界估算（仅信息展示，不参与尺码筛选）
    // 前后脚判定：一正一负取正为前脚；同为正 = 一顺站姿（前脚字段即靠板头一侧）
    var ang = readAngles();
    var stanceInfo = null;
    if (ang.ok && EU) {
      var front = ang.fa, back = ang.ba;
      if (ang.fa <= 0 && ang.ba > 0) { front = ang.ba; back = ang.fa; }
      var oneWay = ang.fa > 0 && ang.ba > 0;
      var halfStance = (best.s.stance || 52) / 2;
      var wF = boardWidthAt(best.s, halfStance);   // 前脚孔位实际板宽（板头侧）
      var wB = boardWidthAt(best.s, -halfStance);  // 后脚孔位实际板宽（板尾侧）
      var bd = bootDims(EU);
      function posOh(angle, w) {
        var rad = Math.abs(angle) * Math.PI / 180;
        return bd.len * Math.cos(rad) + bd.wid * Math.sin(rad) - w;
      }
      var fOh = footOverhang(best.s, EU, front);
      var bOh = footOverhang(best.s, EU, back);
      var v = overhangVerdict(Math.max(fOh, bOh));
      stanceInfo = { fa: front, ba: back, oneWay: oneWay,
                     fOh: fOh, bOh: bOh, max: Math.max(fOh, bOh), verdict: v,
                     wF: wF, wB: wB, fOhPos: posOh(front, wF), bOhPos: posOh(back, wB) };
    }

    return { model: state.model, W: W, H: H, EU: EU, best: best, ranked: ranked,
             alts: alts, style: state.style, pref: state.pref, prefAdjusted: prefAdjusted,
             widthStatus: widthStatus, widthMin: widthMin, widthOk: widthOk,
             manual: manual, autoSize: autoSize,
             stanceDir: state.stanceDir, stanceInfo: stanceInfo };
  }

  /* ---------- 结果渲染 ---------- */
  function showError(msg) {
    var el = $("formError");
    el.textContent = msg;
    el.classList.add("is-show");
  }
  function hideError() { $("formError").classList.remove("is-show"); }

  function rerunMatch() {
    var r = match();
    if (r) {
      state.lastResult = r;
      renderResult(r);
    }
  }

  function renderResult(r) {
    var m = r.model, s = r.best.s;
    $("rModelName").textContent = m.name + " · " + m.category + (m.isSplit ? " · 分离板" : "");

    var numEl = $("rSizeNum");
    numEl.innerHTML = "";
    numEl.appendChild(document.createTextNode(s.len));
    if (s.variant) {                     // 加宽 W / 超宽 UW 随大号数字显示
      var wEl = document.createElement("span");
      wEl.className = "rc-size-w";
      wEl.textContent = s.variant;
      numEl.appendChild(wEl);
    }

    var badges = $("rBadges");
    badges.innerHTML = "";
    var vl = variantLabel(s.variant);
    if (vl) addBadge(badges, vl, false);
    if (s.bigHorn) addBadge(badges, "BIG HORN 大脚专属", true);
    if (m.isNew) addBadge(badges, "26-27 新品", false);
    if (r.manual) addBadge(badges, "手动选择", true);

    // 一句话理由
    var wIn = s.wMin !== null && r.W >= s.wMin && r.W <= s.wMax;
    var why = "你的体重 " + fmt(r.W) + "kg " + (wIn ? "落在" : "不在") + "该尺码官方区间 " + wRangeText(s) + " 内";
    if (r.EU && s.euMin !== null && r.EU >= s.euMin && (s.euMax === null || r.EU <= s.euMax)) {
      why += "，鞋码也在最佳范围 " + euRangeText(s) + " 内";
    }
    if (r.manual) {
      why = "已手动选择 " + s.size + "。" + why;
    } else if (r.prefAdjusted) {
      why += "；按「" + PREF_NAME[r.pref] + "」在区间交界取" + (r.pref === "long" ? "长" : "短") + "一档";
    }
    if (!r.manual && r.widthStatus === "fallback") {
      why += "；该型号没有同时满足体重与大脚宽度的官方尺码，已在当前体重档优先选最宽（板腰 " + fmt(s.waist) + " cm，官方下限 " + fmt(r.widthMin) + " cm）";
    } else if (!r.widthOk) {
      why += "；注意：当前尺码板腰 " + fmt(s.waist) + " cm 低于官方大脚下限 " + fmt(r.widthMin) + " cm";
    }
    $("rWhy").textContent = why + "。";

    // 手动选码：该型号全部尺码芯片（★ 为当前推荐）
    var pick = $("rSizePick");
    pick.innerHTML = "";
    var lbl = document.createElement("span");
    lbl.className = "rsp-label";
    lbl.textContent = "调整尺码";
    pick.appendChild(lbl);
    m.sizes.forEach(function (sz) {
      var c = document.createElement("button");
      c.type = "button";
      c.className = "rsp-chip" + (sz.size === s.size ? " is-on" : "") + (sz.size === r.autoSize ? " is-rec" : "");
      c.textContent = (sz.size === r.autoSize && sz.size !== s.size ? "★" : "") + sz.size;
      c.addEventListener("click", function () {
        state.manualSize = (sz.size === r.autoSize) ? null : sz.size;
        rerunMatch();
      });
      pick.appendChild(c);
    });

    // 匹配依据行
    var rows = $("rMatchRows");
    rows.innerHTML = "";
    addMatchRow(rows, "滑手体重", fmt(r.W) + " kg", true);
    addMatchRow(rows, "官方体重区间", wRangeText(s), false);
    if (r.EU) addMatchRow(rows, "官方最佳鞋码", euRangeText(s), s.euMin !== null && r.EU >= s.euMin && (s.euMax === null || r.EU <= s.euMax));
    if (r.EU && r.EU >= 44) {
      addMatchRow(rows, "大脚宽度校验",
        r.widthOk ? "满足官方板腰下限 ≥" + fmt(r.widthMin) + " cm"
                  : "板腰 " + fmt(s.waist) + " cm < 官方下限 " + fmt(r.widthMin) + " cm",
        r.widthOk);
    }
    addMatchRow(rows, "滑行偏好", PREF_NAME[r.pref], true);
    if (r.style) addMatchRow(rows, "滑行风格", STYLES[r.style].label, true);
    if (r.stanceInfo) {
      addMatchRow(rows, "站姿角度", fmtAngle(r.stanceInfo.fa) + " / " + fmtAngle(r.stanceInfo.ba), false);
    }

    // 规格表
    var spec = $("rSpecTable");
    spec.innerHTML = "";
    addSpecRow(spec, "硬度", s.flex + (m.character ? " · " + m.character : ""));
    if (m.shape) addSpecRow(spec, "板型", m.shape);
    if (m.profile) addSpecRow(spec, "轮廓", m.profile);
    addSpecRow(spec, "板腰宽度", fmt(s.waist) + " cm");
    addSpecRow(spec, "有效边刃", fmt(s.effEdge) + " cm");
    addSpecRow(spec, "参考站距", fmt(s.stance) + " cm");

    // 先展示结果区再画站姿图（canvas 需要真实宽度计算高度）
    document.body.classList.add("in-result");
    $("resultView").classList.add("is-show");
    window.scrollTo(0, 0);

    // 站姿出界检测
    var stanceBox = $("rStance");
    if (r.stanceInfo) {
      stanceBox.style.display = "";
      drawStanceDiagram($("stanceCanvas"), r);
      var sv = $("stanceVerdict");
      sv.innerHTML = "";
      sv.appendChild(document.createTextNode(
        (r.stanceDir === "goofy" ? "右脚前 · " : "左脚前 · ") +
        "前脚 " + fmtAngle(r.stanceInfo.fa) + " · 后脚 " + fmtAngle(r.stanceInfo.ba) +
        (r.stanceInfo.oneWay ? "（一顺站姿）" : "") +
        "：最大出界 " + fmt(r.stanceInfo.fOh) + " / " + fmt(r.stanceInfo.bOh) +
        " cm（按板腰最窄处；脚位板宽处约 " + fmt(r.stanceInfo.fOhPos) + " / " + fmt(r.stanceInfo.bOhPos) + " cm）— "));
      var vb = document.createElement("b");
      vb.className = r.stanceInfo.verdict.cls;
      vb.textContent = r.stanceInfo.verdict.text;
      sv.appendChild(vb);
    } else {
      stanceBox.style.display = "none";
    }

    // 备选
    var alt = $("rAlt");
    if (r.alts.length) {
      var html = "交界备选：";
      r.alts.forEach(function (a) {
        html += "<b>" + a.s.size + (a.s.variant ? "" : "cm") + "</b>（" + wRangeText(a.s) + "） ";
      });
      html += "—— 体重处在两档交界时，灵活玩法取短、高速稳定取长。";
      alt.innerHTML = html;
      alt.style.display = "";
    } else {
      alt.style.display = "none";
    }

    // 身高参考提示
    var note = $("rHeightNote");
    var lo = r.H - 25, hi = r.H - 15;
    if (s.len < lo) {
      note.textContent = "身高参考：按你的身高 " + fmt(r.H) + "cm，常规板长区间约 " + lo + "–" + hi +
        "cm。推荐尺码偏短通常是因为体重区间匹配，短板更灵活易控；若追求高速稳定可考虑相邻加长档。";
      note.classList.add("is-show");
    } else if (s.len > hi) {
      note.textContent = "身高参考：按你的身高 " + fmt(r.H) + "cm，常规板长区间约 " + lo + "–" + hi +
        "cm。推荐尺码偏长通常对应你的体重区间，长板浮力与稳定性更好；若偏好转体和平花可考虑相邻缩短档。";
      note.classList.add("is-show");
    } else {
      note.classList.remove("is-show");
    }
  }

  function addBadge(box, text, gold) {
    var b = document.createElement("span");
    b.className = "badge" + (gold ? " bh" : "");
    b.textContent = text;
    box.appendChild(b);
  }
  function addMatchRow(box, k, v, ok) {
    var row = document.createElement("div");
    row.className = "match-row";
    var kEl = document.createElement("span");
    kEl.className = "mk"; kEl.textContent = k;
    var vEl = document.createElement("span");
    vEl.className = "mv" + (ok ? " ok" : "");
    vEl.textContent = v + (ok ? " ✓" : "");
    row.appendChild(kEl); row.appendChild(vEl);
    box.appendChild(row);
  }
  function addSpecRow(table, k, v) {
    var tr = document.createElement("tr");
    var td1 = document.createElement("td"); td1.textContent = k;
    var td2 = document.createElement("td"); td2.textContent = v;
    tr.appendChild(td1); tr.appendChild(td2);
    table.appendChild(tr);
  }

  /* ---------- 站姿出界检测（条形图数据展示） ---------- */
  function drawStanceDiagram(canvas, r) {
    var s = r.best.s, si = r.stanceInfo;
    var W = 660, H = 226;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.height = Math.round((canvas.clientWidth || W) * H / W) + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var d = bootDims(r.EU);
    var COL = {
      ok: "#8ee6bd", warn: "#f4c34d", bad: "#ff9d9d",
      ink: "rgba(255,255,255,0.92)", sub: "rgba(255,255,255,0.58)",
      faint: "rgba(255,255,255,0.36)"
    };

    function projOf(a) {
      var rad = Math.abs(a) * Math.PI / 180;
      return d.len * Math.cos(rad) + d.wid * Math.sin(rad);
    }
    function footState(oh) {
      if (oh > 0.15) return { cls: "bad", txt: "最大出界 " + fmt(oh) + " cm" };
      if (oh > -0.5) return { cls: "warn", txt: "贴边" };
      return { cls: "ok", txt: "余量 " + fmt(-oh) + " cm" };
    }

    var feet = [
      { name: "前脚", a: si.fa, oh: si.fOh, w: si.wF, ohPos: si.fOhPos },
      { name: "后脚", a: si.ba, oh: si.bOh, w: si.wB, ohPos: si.bOhPos }
    ];
    var projs = feet.map(function (f) { return projOf(f.a); });

    // 横轴比例尺：覆盖板腰、脚位板宽与两脚投影，留 12% 余量
    var scaleMax = Math.ceil(Math.max(s.waist, si.wF, si.wB, projs[0], projs[1]) * 1.12 * 2) / 2;
    var gx = 168, gw = 300;
    function pxOf(v) { return gx + gw * v / scaleMax; }

    feet.forEach(function (f, i) {
      var y = 58 + i * 80;
      var st = footState(f.oh);
      var proj = projs[i];

      // 脚名
      ctx.textAlign = "left";
      ctx.font = "700 17px sans-serif";
      ctx.fillStyle = COL.ink;
      ctx.fillText(f.name, 18, y + 6);

      // 角度胶囊
      var at = fmtAngle(f.a);
      ctx.font = "600 14px sans-serif";
      var aw = ctx.measureText(at).width + 26;
      roundRect(ctx, 68, y - 12, aw, 25, 12);
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(at, 81, y + 5);

      // 轨道
      roundRect(ctx, gx, y - 8, gw, 16, 8);
      ctx.fillStyle = "rgba(255,255,255,0.09)";
      ctx.fill();

      // 板腰阈值线（官方口径：最大出界基准）
      ctx.strokeStyle = "rgba(255,255,255,0.60)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pxOf(s.waist), y - 17);
      ctx.lineTo(pxOf(s.waist), y + 17);
      ctx.stroke();
      ctx.font = "500 12px sans-serif";
      ctx.fillStyle = COL.faint;
      ctx.textAlign = "center";
      ctx.fillText("板腰 " + fmt(s.waist), pxOf(s.waist), y - 23);

      // 靴子投影条：板腰内绿色，越线部分红色
      var inW = Math.min(proj, s.waist) / scaleMax * gw;
      var overW = Math.max(0, proj - s.waist) / scaleMax * gw;
      if (inW > 1) {
        roundRect(ctx, gx, y - 8, inW, 16, 8);
        ctx.fillStyle = (st.cls === "ok") ? "#5ecf9f" : "rgba(142,230,189,0.60)";
        ctx.fill();
      }
      if (overW > 1) {
        roundRect(ctx, pxOf(s.waist) - 1, y - 8, overW + 1, 16, 3);
        ctx.fillStyle = "#ff8f8a";
        ctx.fill();
      }

      // 右侧数值 + 状态 + 脚位板宽参考
      ctx.textAlign = "left";
      ctx.font = "500 13.5px sans-serif";
      ctx.fillStyle = COL.sub;
      ctx.fillText("靴子投影 " + fmt(proj) + " cm", 498, y - 1);
      ctx.font = "700 15px sans-serif";
      ctx.fillStyle = COL[st.cls];
      ctx.fillText(st.txt, 498, y + 21);
      ctx.font = "400 11.5px sans-serif";
      ctx.fillStyle = COL.faint;
      var posTxt = "脚位板宽 " + fmt(f.w) + " · " +
        (f.ohPos > 0.15 ? "出界 " + fmt(f.ohPos) : (f.ohPos > -0.5 ? "贴边" : "余量 " + fmt(-f.ohPos))) + " cm";
      ctx.fillText(posTxt, 498, y + 40);
    });

    // 刻度轴（两行下方）
    var ay = 182;
    var step = scaleMax > 26 ? 10 : 5;
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    for (var v = 0; v <= scaleMax + 0.01; v += step) {
      var x = pxOf(v);
      ctx.beginPath();
      ctx.moveTo(x, ay);
      ctx.lineTo(x, ay + 5);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.font = "400 11px sans-serif";
      ctx.fillStyle = COL.faint;
      ctx.fillText(String(v), x, ay + 18);
    }
    ctx.beginPath();
    ctx.moveTo(gx, ay);
    ctx.lineTo(gx + gw, ay);
    ctx.stroke();

    // 底注
    ctx.font = "400 12px sans-serif";
    ctx.fillStyle = COL.faint;
    ctx.textAlign = "left";
    ctx.fillText("出界按板腰（板最窄处）计算 = 最大情况；脚位板宽为固定器孔位处实际宽度", 18, H - 10);
    if (si.oneWay) {
      ctx.textAlign = "right";
      ctx.fillText("一顺站姿 · 双脚同向板头", W - 18, H - 10);
    }
    ctx.textAlign = "left";
  }

  /* ---------- 结果卡片（Canvas）与保存 ---------- */
  var CARD_THEMES = {
    none:  { bg: "bg-balanced.webp", sky1: "#081a2e", sky2: "#12395c", sky3: "#2e5f83", sky4: "#6d95b3",
             glow: "rgba(125,185,240,0.42)" },
    short: { bg: "bg-flexible.webp", sky1: "#062218", sky2: "#10402e", sky3: "#2b6b4c", sky4: "#79a88f",
             glow: "rgba(135,225,175,0.40)" },
    long:  { bg: "bg-stable.webp",   sky1: "#250a10", sky2: "#571e24", sky3: "#834046", sky4: "#b37e80",
             glow: "rgba(245,155,145,0.40)" }
  };

  var CARD_SCALE = 2;  // 导出倍率：画布物理 1500x2360，绘制坐标仍按 750x1180 逻辑写
  function drawCard(r, boardImg, bgImg) {
    var cv = document.createElement("canvas");
    cv.width = 750 * CARD_SCALE; cv.height = 1180 * CARD_SCALE;
    var ctx = cv.getContext("2d");
    ctx.scale(CARD_SCALE, CARD_SCALE);
    var s = r.best.s, m = r.model;
    var t = CARD_THEMES[r.pref] || CARD_THEMES.none;

    // ---- 背景图（按滑行偏好主题，标题已含在图内）；加载失败退回纯色夜空 ----
    if (bgImg) {
      var k = Math.max(750 / bgImg.width, 1180 / bgImg.height);
      ctx.drawImage(bgImg, (750 - bgImg.width * k) / 2, (1180 - bgImg.height * k) / 2,
                    bgImg.width * k, bgImg.height * k);
      var sc = ctx.createLinearGradient(0, 600, 0, 1180);
      sc.addColorStop(0, "rgba(8,10,16,0)");
      sc.addColorStop(0.45, "rgba(8,10,16,0.42)");
      sc.addColorStop(1, "rgba(8,10,16,0.66)");
      ctx.fillStyle = sc; ctx.fillRect(0, 600, 750, 580);
    } else {
      var g = ctx.createLinearGradient(0, 0, 0, 1180);
      g.addColorStop(0, t.sky1); g.addColorStop(0.45, t.sky2);
      g.addColorStop(0.75, t.sky3); g.addColorStop(1, t.sky4);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 750, 1180);
    }

    // ---- 板子光晕 + 雪板实拍（立于光环正中） ----
    var bg2 = ctx.createRadialGradient(375, 455, 30, 375, 455, 290);
    bg2.addColorStop(0, t.glow); bg2.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = bg2; ctx.fillRect(60, 120, 630, 620);

    if (boardImg) {
      var bh = 400, bw = boardImg.width / boardImg.height * bh;
      ctx.save();
      ctx.translate(375, 462);
      ctx.rotate(-6 * Math.PI / 180);
      ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
      ctx.drawImage(boardImg, -bw / 2, -bh / 2, bw, bh);
      ctx.restore();
    }

    // ---- 飘雪点缀 ----
    ctx.fillStyle = "#fff";
    for (var si = 0; si < 70; si++) {
      ctx.globalAlpha = 0.18 + (si % 5) * 0.12;
      ctx.beginPath();
      ctx.arc((si * 211 + 53) % 740 + 5, (si * 307 + 89) % 1120 + 20, (si % 3) * 0.8 + 0.8, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- 推荐尺码（数字 + W/UW 后缀 + cm 整体居中） ----
    ctx.font = "800 116px sans-serif";
    var numText = String(s.len);
    var numW = ctx.measureText(numText).width;
    var suffix = s.variant || "";
    ctx.font = "800 50px sans-serif";
    var sufW = suffix ? ctx.measureText(suffix).width + 12 : 0;
    ctx.font = "400 34px sans-serif";
    var cmW = ctx.measureText("cm").width + 12;
    var x0 = 375 - (numW + sufW + cmW) / 2;
    ctx.textAlign = "left";
    ctx.font = "800 116px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(numText, x0, 765);
    if (suffix) {
      ctx.font = "800 50px sans-serif";
      ctx.fillStyle = "#ffd76e";
      ctx.fillText(suffix, x0 + numW + 12, 765);
    }
    ctx.font = "400 34px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("cm", x0 + numW + sufW, 765);
    ctx.textAlign = "center";

    // ---- 型号与标签 ----
    ctx.font = "700 36px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(m.name, 375, 822);
    ctx.font = "400 24px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    var tags = [m.category, m.audience, "硬度 " + s.flex];
    if (s.bigHorn) tags.push("Big Horn");
    ctx.fillText(tags.join(" · "), 375, 858);

    // ---- 个人数据铭牌 ----
    var st1 = STYLES[r.style] ? STYLES[r.style].label : null;
    var stanceRow = (r.stanceInfo && r.EU)
      ? (r.stanceDir === "goofy" ? "右脚前 " : "左脚前 ") +
        fmtAngle(r.stanceInfo.fa) + " / " + fmtAngle(r.stanceInfo.ba) : null;
    var px = 60, py = 884, pw = 630, ph = stanceRow ? 220 : 186;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, px, py, pw, ph, 22); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.5;
    roundRect(ctx, px, py, pw, ph, 22); ctx.stroke();

    var rows = [
      ["身高 / 体重", fmt(r.H) + " cm · " + fmt(r.W) + " kg"],
      ["鞋码", r.EU ? "EU " + fmt(r.EU) : "未填写"],
      ["滑行偏好", PREF_NAME[r.pref] + (st1 ? " · " + st1 : "")],
    ];
    if (stanceRow) rows.push(["站姿角度", stanceRow]);
    rows.push(["官方体重区间", wRangeText(s) + (s.wMin !== null && r.W >= s.wMin && r.W <= s.wMax ? " ✓" : " 超范围")]);
    var ry = py + 42;
    rows.forEach(function (row) {
      ctx.textAlign = "left";
      ctx.font = "400 24px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.fillText(row[0], px + 34, ry);
      ctx.textAlign = "right";
      ctx.font = "600 26px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(row[1], px + pw - 34, ry);
      ry += 35;
    });

    // ---- 底部引导 ----
    ctx.textAlign = "center";
    ctx.font = "400 22px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText("Jones雪板尺寸选择助手 · 数据来自官方目录", 375, 1128);
    ctx.font = "700 26px sans-serif";
    ctx.fillStyle = "#f4c34d";
    ctx.fillText("来测测你的本命板 →", 375, 1164);

    ctx.textAlign = "left";
    return cv;
  }
  window.__drawCard = drawCard;  // 调试/预览钩子

  function saveCard() {
    if (!state.lastResult) return;
    var r = state.lastResult;
    var img = new Image();
    var t = CARD_THEMES[r.pref] || CARD_THEMES.none;
    var todo = (r.model.img ? 1 : 0) + 1, boardImg = null, bgImg = null;
    function step() { if (--todo <= 0) finish(drawCard(r, boardImg, bgImg)); }
    function finish(cv) {
      // 2x 画布下 PNG 解码后约 4MB，远超单条 Base64 1MiB 预算；
      // 卡片为全不透明照片类内容，JPEG q0.92 视觉无损且体积可控
      var dataUri = cv.toDataURL("image/jpeg", 0.92);
      var mt = window.xhs && window.xhs.miniTool;
      if (mt && mt.saveImageToPhotosAlbum) {
        shareCard(mt, r, dataUri);
      } else {
        toast("保存与分享需在小红书 App 内打开使用");
      }
    }
    if (r.model.img) {
      img.onload = function () { boardImg = img; step(); };
      img.onerror = step;
      img.src = r.model.img;
    }
    var bg = new Image();
    bg.onload = function () { bgImg = bg; step(); };
    bg.onerror = step;
    bg.src = "assets/" + t.bg + "?v=1";
  }

  // 笔记标题：按剩余字数从强到弱选钩子，保证含型号+尺码且 ≤20 字
  function noteTitle(m, size) {
    var short = m.name
      .replace(/^Men’s /, "").replace(/^Women’s /, "")
      .replace(/^Ultralight /, "").replace(/ Split$/, "");   // 标题中省去冗余前后缀
    var base = short + " " + size;
    var hooks = ["雪板尺寸抄作业：", "本命板定了：", "定了！"];
    for (var i = 0; i < hooks.length; i++) {
      if (hooks[i].length + base.length <= 20) return hooks[i] + base;
    }
    if (base.length <= 20) return base;
    var maxShort = 20 - 1 - String(size).length;
    return short.slice(0, maxShort - 1) + "… " + size;
  }

  // 保存到相册 + 唤起发笔记（用户可在发布页继续编辑或取消）
  async function shareCard(mt, r, dataUri) {
    // 大 base64 先写临时文件换取 filePath，供相册与发布共用；失败回退 data:uri
    var filePath = dataUri;
    if (mt.writeTempFile) {
      try {
        filePath = (await mt.writeTempFile({ data: dataUri })).filePath;
      } catch (e) { filePath = dataUri; }
    }
    try {
      await mt.saveImageToPhotosAlbum({ filePath: filePath });
      toast("卡片已保存到相册");
    } catch (err) {
      toast("相册保存失败：" + ((err && err.errMsg) || "未知错误"));
    }
    if (!mt.postNote) return;
    try {
      // 分享导向：晒出自己的选择，帮条件相近的雪友直接参考（身体数据在卡片图中）
      var s = r.best.s;
      await mt.postNote({
        title: noteTitle(r.model, s.size),
        content: "用「Jones雪板尺寸选择助手」选定了本命板：" +
          r.model.name + " " + s.size + "（" + r.model.category +
          (r.pref !== "none" ? " · " + PREF_NAME[r.pref] : "") +
          "）。卡片里有我的身高体重和鞋码，条件相近的雪友可以直接参考，纠结尺寸的快去测测吧！",
        tags: "#单板滑雪 #Jones #雪板尺寸 #滑雪装备",
        mediaInfo: { image_resources: [{ url: filePath }] }
      });
    } catch (err) {
      // 用户在发布页取消属正常操作，不打扰
      var msg = (err && err.errMsg) || "";
      if (msg.indexOf("cancel") < 0) toast("唤起发布页失败：" + msg);
    }
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- 背景大雪（Canvas 2D，页面隐藏时暂停） ---------- */
  function initSnow() {
    var canvas = document.getElementById("snowCanvas");
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, flakes = [], t = 0, running = false, rafId = 0;
    var reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    // 大颗柔边雪花用预渲染精灵，避免每帧径向渐变
    var sprite = document.createElement("canvas");
    sprite.width = 48; sprite.height = 48;
    var sctx = sprite.getContext("2d");
    var sg = sctx.createRadialGradient(24, 24, 2, 24, 24, 22);
    sg.addColorStop(0, "rgba(255,255,255,0.85)");
    sg.addColorStop(0.6, "rgba(255,255,255,0.35)");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 48, 48);

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = document.documentElement.clientWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn() {
      flakes = [];
      var count = W > 600 ? 150 : 110;
      for (var i = 0; i < count; i++) {
        var big = Math.random() < 0.18;
        flakes.push({
          x: Math.random() * W, y: Math.random() * H,
          r: big ? 4 + Math.random() * 4 : 0.8 + Math.random() * 2.2,
          s: big ? 1.2 + Math.random() * 1.2 : 0.5 + Math.random() * 1.1,
          a: big ? 0.4 + Math.random() * 0.3 : 0.35 + Math.random() * 0.55,
          ph: Math.random() * Math.PI * 2,
          sw: 0.3 + Math.random() * 0.9,
          big: big
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        ctx.globalAlpha = f.a;
        if (f.big) {
          ctx.drawImage(sprite, f.x - f.r * 2.2, f.y - f.r * 2.2, f.r * 4.4, f.r * 4.4);
        } else {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, 6.2832);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function frame() {
      if (!running) return;
      t += 0.016;
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        f.y += f.s * (1 + f.r * 0.18);
        f.x += Math.sin(t * 1.3 + f.ph) * f.sw * 0.45 - 0.12;
        if (f.y > H + 8) { f.y = -8; f.x = Math.random() * W; }
        if (f.x < -10) f.x = W + 8; else if (f.x > W + 10) f.x = -8;
      }
      draw();
      rafId = requestAnimationFrame(frame);
    }

    function start() {
      if (!running && !reduced) { running = true; rafId = requestAnimationFrame(frame); }
    }
    function stop() { running = false; cancelAnimationFrame(rafId); }

    resize();
    spawn();
    if (reduced) { draw(); return; }
    start();

    window.addEventListener("resize", function () { resize(); spawn(); if (reduced) draw(); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });
  }

  /* ---------- 事件绑定与启动 ---------- */
  function init() {
    initSnow();
    renderModelSelect();
    buildBootSelect();
    buildStanceSelects();
    bindSlider("heightInput", "heightVal");
    bindSlider("weightInput", "weightVal");
    bindChips();
    bindPrefs();
    bindStyles();

    $("modelSelect").addEventListener("change", function (e) {
      state.model = findModel(e.target.value);
      state.manualSize = null;          // 换型号后手动选码失效
      renderModelMeta();
    });

    $("matchBtn").addEventListener("click", function () {
      rerunMatch();
    });

    $("backBtn").addEventListener("click", function () {
      document.body.classList.remove("in-result");
      $("resultView").classList.remove("is-show");
      window.scrollTo(0, 0);
    });

    $("saveBtn").addEventListener("click", saveCard);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
