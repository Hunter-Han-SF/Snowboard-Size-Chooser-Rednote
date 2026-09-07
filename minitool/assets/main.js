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
  function scoreSizes(model, W, EU) {
    return model.sizes.map(function (s) {
      var wScore;
      if (s.wMin !== null && W >= s.wMin && W <= s.wMax) {
        wScore = 100;
      } else {
        var d = (s.wMin === null) ? 99 : (W < s.wMin ? s.wMin - W : W - s.wMax);
        wScore = Math.max(0, 100 - d * 12);
      }
      var euScore = 0;
      if (EU) {
        if (s.euMin !== null && EU >= s.euMin && (s.euMax === null || EU <= s.euMax)) {
          euScore = 40;
        } else if (s.euMin !== null) {
          var dE = EU < s.euMin ? s.euMin - EU : (s.euMax === null ? 0 : EU - s.euMax);
          euScore = Math.max(0, 40 - dE * 10);
        }
      }
      var bhBonus = (EU >= 44.5 && s.bigHorn) ? 18 : 0;
      return { s: s, total: wScore + euScore + bhBonus };
    });
  }

  function pickBest(scored, W, pref) {
    var arr = scored.slice();
    arr.sort(function (a, b) {
      if (b.total !== a.total) return b.total - a.total;
      // 未由鞋码驱动时，常规版优先于加宽/窄版
      var va = a.s.variant ? 1 : 0, vb = b.s.variant ? 1 : 0;
      if (va !== vb) return va - vb;
      // 官方体重区间中心离用户更近的优先
      var ca = Math.abs((a.s.wMin + a.s.wMax) / 2 - W);
      var cb = Math.abs((b.s.wMin + b.s.wMax) / 2 - W);
      if (ca !== cb) return ca - cb;
      // 完全同区间时按偏好取短/取长
      if (pref === "short") return a.s.len - b.s.len;
      if (pref === "long") return b.s.len - a.s.len;
      return 0;
    });
    return arr;
  }

  function match() {
    var W = parseFloat($("weightInput").value);
    var H = parseFloat($("heightInput").value);
    var euVal = $("bootSelect").value;
    var EU = euVal ? parseFloat(euVal) : null;

    if (!state.model) { showError("请先选择雪板型号"); return null; }
    hideError();

    var ranked = pickBest(scoreSizes(state.model, W, EU), W, state.pref);

    // 尺码仅由滑行偏好驱动：同分常规版候选中按偏好取紧邻的短/长一档
    // （鞋码只参与打分与加宽版推荐，滑行风格不影响尺码）
    var best = ranked[0];
    var top = ranked[0];
    var sameScore = ranked.filter(function (r) {
      return r.total === top.total && !r.s.variant;
    });
    var adj = null;
    if (state.pref === "short") {
      sameScore.forEach(function (r) {
        if (r.s.len < top.s.len && (!adj || r.s.len > adj.s.len)) adj = r;
      });
    } else if (state.pref === "long") {
      sameScore.forEach(function (r) {
        if (r.s.len > top.s.len && (!adj || r.s.len < adj.s.len)) adj = r;
      });
    }
    var prefAdjusted = false;
    if (adj) { best = adj; prefAdjusted = true; }

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
    none:  { sky1: "#081a2e", sky2: "#12395c", sky3: "#2e5f83", sky4: "#6d95b3",
             far: "rgba(120,165,200,0.35)", mid: "#28506f", near: "#14304a",
             glow: "rgba(122,182,236,0.55)", aur1: "122,182,236", aur2: "150,120,220" },
    short: { sky1: "#062218", sky2: "#10402e", sky3: "#2b6b4c", sky4: "#79a88f",
             far: "rgba(120,200,160,0.30)", mid: "#235c41", near: "#0f3526",
             glow: "rgba(126,214,170,0.50)", aur1: "126,214,170", aur2: "110,220,205" },
    long:  { sky1: "#250a10", sky2: "#571e24", sky3: "#834046", sky4: "#b37e80",
             far: "rgba(220,150,150,0.30)", mid: "#5f3338", near: "#330f14",
             glow: "rgba(240,150,150,0.45)", aur1: "240,150,150", aur2: "235,175,120" }
  };

  function drawCard(r, boardImg) {
    var cv = document.createElement("canvas");
    cv.width = 750; cv.height = 1180;
    var ctx = cv.getContext("2d");
    var s = r.best.s, m = r.model;
    var t = CARD_THEMES[r.pref] || CARD_THEMES.none;
    var GOLD = "#ffd76e";

    // ---------- 夜空 ----------
    var g = ctx.createLinearGradient(0, 0, 0, 1180);
    g.addColorStop(0, t.sky1); g.addColorStop(0.45, t.sky2);
    g.addColorStop(0.75, t.sky3); g.addColorStop(1, t.sky4);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 750, 1180);

    // 星星（含四角星点缀）
    ctx.fillStyle = "#fff";
    for (var i = 0; i < 52; i++) {
      var sx = (i * 173 + 31) % 730 + 10, sy = (i * 97 + 17) % 430 + 20;
      ctx.globalAlpha = 0.25 + (i * 7 % 10) * 0.06;
      ctx.beginPath();
      ctx.arc(sx, sy, (i % 3) * 0.6 + 0.9, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    [[90, 90], [655, 250], [210, 300], [520, 70]].forEach(function (p, k) {
      ctx.globalAlpha = 0.85 - k * 0.15;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1] - 7); ctx.lineTo(p[0] + 2, p[1] - 2);
      ctx.lineTo(p[0] + 7, p[1]); ctx.lineTo(p[0] + 2, p[1] + 2);
      ctx.lineTo(p[0], p[1] + 7); ctx.lineTo(p[0] - 2, p[1] + 2);
      ctx.lineTo(p[0] - 7, p[1]); ctx.lineTo(p[0] - 2, p[1] - 2);
      ctx.closePath(); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // 月亮
    var mg = ctx.createRadialGradient(618, 128, 8, 618, 128, 120);
    mg.addColorStop(0, "rgba(255,255,255,0.4)"); mg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = mg; ctx.fillRect(470, 0, 300, 270);
    ctx.fillStyle = "rgba(243,248,252,0.96)";
    ctx.beginPath(); ctx.arc(618, 128, 26, 0, 6.2832); ctx.fill();

    // ---------- 极光带 ----------
    function aurora(y0, amp, rgb, alpha, phase) {
      ctx.beginPath();
      ctx.moveTo(-40, y0 + Math.sin(phase) * amp);
      for (var x = -40; x <= 790; x += 12) {
        ctx.lineTo(x, y0 + Math.sin(x / 150 + phase) * amp + Math.sin(x / 53 + phase * 2) * amp * 0.3);
      }
      for (var x2 = 790; x2 >= -40; x2 -= 12) {
        ctx.lineTo(x2, y0 + 96 + Math.sin(x2 / 120 + 1.4 + phase) * amp * 0.7);
      }
      ctx.closePath();
      var ag = ctx.createLinearGradient(0, y0 - amp, 0, y0 + 130);
      ag.addColorStop(0, "rgba(" + rgb + "," + alpha + ")");
      ag.addColorStop(1, "rgba(" + rgb + ",0)");
      ctx.fillStyle = ag; ctx.fill();
    }
    aurora(84, 16, t.aur1, 0.30, 0);
    aurora(150, 20, t.aur2, 0.22, 1.8);
    aurora(236, 13, t.aur1, 0.16, 3.6);

    // ---------- 山峦（雪帽）----------
    ctx.fillStyle = t.far;
    poly(ctx, [[0, 470], [120, 384], [215, 452], [330, 358], [445, 462], [560, 392], [665, 470], [750, 408], [750, 560], [0, 560]]);
    ctx.fillStyle = t.mid;
    poly(ctx, [[0, 560], [140, 442], [255, 540], [400, 418], [545, 552], [665, 452], [750, 528], [750, 700], [0, 700]]);
    ctx.fillStyle = "rgba(244,249,253,0.9)";
    poly(ctx, [[366, 480], [400, 418], [432, 480], [418, 470], [404, 484], [388, 468], [374, 482]]);
    ctx.fillStyle = t.near;
    poly(ctx, [[0, 655], [150, 540], [270, 640], [420, 524], [560, 648], [680, 556], [750, 620], [750, 1180], [0, 1180]]);
    ctx.fillStyle = "rgba(238,245,250,0.85)";
    poly(ctx, [[596, 616], [680, 556], [706, 618], [688, 606], [672, 622], [656, 604], [640, 620], [620, 606]]);

    // ---------- 雪板：光晕 + 实拍 + 倒影 ----------
    var bh = 420, bw = boardImg ? boardImg.width / boardImg.height * bh : 118;
    var halo = ctx.createRadialGradient(375, 318, 30, 375, 318, 300);
    halo.addColorStop(0, t.glow); halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo; ctx.fillRect(50, 20, 650, 620);
    if (boardImg) {
      ctx.save();
      ctx.translate(375, 318);
      ctx.rotate(-6 * Math.PI / 180);
      ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 46; ctx.shadowOffsetY = 20;
      ctx.drawImage(boardImg, -bw / 2, -bh / 2, bw, bh);
      ctx.restore();
      // 倒影（截板底 120px，翻转渐隐）
      var rc = document.createElement("canvas");
      rc.width = Math.max(2, Math.round(bw)); rc.height = 120;
      var rctx = rc.getContext("2d");
      rctx.translate(0, 0); rctx.scale(1, -1);
      rctx.drawImage(boardImg, 0, -bh, rc.width, bh);
      var rgrad = rctx.createLinearGradient(0, 0, 0, 120);
      rgrad.addColorStop(0, "rgba(255,255,255,0.3)"); rgrad.addColorStop(1, "rgba(255,255,255,0)");
      rctx.globalCompositeOperation = "destination-in";
      rctx.fillStyle = rgrad; rctx.fillRect(0, 0, rc.width, 120);
      ctx.save();
      ctx.translate(375, 530);
      ctx.rotate(-6 * Math.PI / 180);
      ctx.globalAlpha = 0.35;
      ctx.drawImage(rc, -bw / 2, 4);
      ctx.restore();
    }

    // ---------- 飘雪 ----------
    ctx.fillStyle = "#fff";
    for (var si = 0; si < 64; si++) {
      ctx.globalAlpha = 0.16 + (si % 5) * 0.1;
      ctx.beginPath();
      ctx.arc((si * 211 + 53) % 740 + 5, (si * 307 + 89) % 1120 + 20, (si % 3) * 0.8 + 0.8, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---------- 顶部标题 ----------
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "600 22px sans-serif";
    ctx.fillText("J O N E S   S N O W B O A R D S   2 6 - 2 7", 375, 54);
    ctx.shadowColor = t.glow; ctx.shadowBlur = 15;
    ctx.fillStyle = "#fff";
    ctx.font = "900 52px sans-serif";
    ctx.fillText("我的本命板", 375, 114);
    ctx.shadowBlur = 0;
    // 新品徽标
    if (m.isNew) {
      ctx.save();
      roundRect(ctx, 34, 36, 128, 34, 17);
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = GOLD; ctx.font = "700 19px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("NEW 26-27", 98, 59);
      ctx.restore();
    }

    // ---------- 尺寸主视觉 ----------
    // 徽章：官方推荐 / 手动选择
    ctx.font = "600 21px sans-serif";
    var chipTxt = "官方推荐尺码";
    var chipW = ctx.measureText(chipTxt).width + 34;
    var manualTxt = r.manual ? "手动选择" : null;
    ctx.font = "600 21px sans-serif";
    var manualW = manualTxt ? ctx.measureText(manualTxt).width + 34 : 0;
    var gap = manualTxt ? 14 : 0;
    var chipsX = 375 - (chipW + gap + manualW) / 2;
    roundRect(ctx, chipsX, 652, chipW, 34, 17);
    ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.textAlign = "center";
    ctx.fillText(chipTxt, chipsX + chipW / 2, 675);
    if (manualTxt) {
      roundRect(ctx, chipsX + chipW + gap, 652, manualW, 34, 17);
      ctx.fillStyle = GOLD;
      ctx.fill();
      ctx.fillStyle = "#12324e";
      ctx.fillText(manualTxt, chipsX + chipW + gap + manualW / 2, 675);
    }
    // 数字（发光 + W 后缀 + cm，整体居中）
    var numText = String(s.len);
    var suffix = s.variant || "";
    ctx.font = "900 128px sans-serif";
    var numW2 = ctx.measureText(numText).width;
    ctx.font = "800 56px sans-serif";
    var sufW2 = suffix ? ctx.measureText(suffix).width + 14 : 0;
    ctx.font = "400 36px sans-serif";
    var cmW2 = ctx.measureText("cm").width + 12;
    var x0 = 375 - (numW2 + sufW2 + cmW2) / 2;
    ctx.textAlign = "left";
    ctx.font = "900 128px sans-serif";
    ctx.shadowColor = t.glow; ctx.shadowBlur = 30;
    ctx.fillStyle = "#fff";
    ctx.fillText(numText, x0, 788);
    ctx.shadowBlur = 0;
    if (suffix) {
      ctx.font = "800 56px sans-serif";
      ctx.fillStyle = GOLD;
      ctx.fillText(suffix, x0 + numW2 + 14, 788);
    }
    ctx.font = "400 36px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("cm", x0 + numW2 + sufW2, 788);

    // ---------- 型号与标签 ----------
    ctx.textAlign = "center";
    ctx.font = "800 34px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(m.name, 375, 838);
    ctx.font = "400 22px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    var tags = [m.category, m.audience, "硬度 " + s.flex];
    if (s.bigHorn) tags.push("Big Horn");
    if (m.character) tags.push(m.character);
    ctx.fillText(tags.join(" · "), 375, 872);

    // ---------- 地形三维分条 ----------
    if (m.scores && m.scores.length === 3) {
      var itemW = 196, barMax = 86, sy = 908;
      var startX = 375 - (itemW * 3) / 2;
      ctx.textAlign = "left";
      m.scores.forEach(function (sc, k) {
        var ix = startX + k * itemW;
        ctx.font = "600 19px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.68)";
        ctx.fillText(sc.l, ix, sy);
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        roundRect(ctx, ix, sy + 10, barMax, 7, 3.5); ctx.fill();
        ctx.fillStyle = "rgba(" + t.aur1 + ",0.95)";
        roundRect(ctx, ix, sy + 10, Math.max(4, barMax * sc.v / 10), 7, 3.5); ctx.fill();
        ctx.font = "800 20px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "right";
        ctx.fillText(sc.v + "/10", ix + barMax, sy + 34);
        ctx.textAlign = "left";
      });
      ctx.textAlign = "center";
    }

    // ---------- 数据玻璃卡 ----------
    var st1 = STYLES[r.style] ? STYLES[r.style].label : null;
    var stanceRow = (r.stanceInfo && r.EU)
      ? (r.stanceDir === "goofy" ? "右脚前 " : "左脚前 ") +
        fmtAngle(r.stanceInfo.fa) + " / " + fmtAngle(r.stanceInfo.ba) : null;
    var rows = [
      ["身高 / 体重 / 鞋码", fmt(r.H) + "cm · " + fmt(r.W) + "kg" + (r.EU ? " · EU " + fmt(r.EU) : "")],
      ["滑行偏好", PREF_NAME[r.pref] + (st1 ? " · " + st1 : "")],
    ];
    if (stanceRow) {
      var vCls = r.stanceInfo.verdict.cls;           // ok / warn / bad
      var vCol = { ok: "#8ee6bd", warn: "#f4c34d", bad: "#ff9d9d" }[vCls];
      var vTxt = vCls === "ok" ? "出界检测 通过" :
        "出界 " + fmt(Math.max(r.stanceInfo.fOh, r.stanceInfo.bOh)) + "cm";
      rows.push(["站姿角度", stanceRow, vTxt, vCol]);
    }
    rows.push(["官方体重区间", wRangeText(s) +
      (s.wMin !== null && r.W >= s.wMin && r.W <= s.wMax ? " ✓" : " 超范围")]);

    var px = 50, pw = 650;
    var rh = 34, py = 956, ph = 22 + rows.length * rh + 14;
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    roundRect(ctx, px, py, pw, ph, 24); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.32)"; ctx.lineWidth = 1.5;
    roundRect(ctx, px, py, pw, ph, 24); ctx.stroke();
    // 顶部高光细线
    ctx.strokeStyle = "rgba(255,255,255,0.28)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px + 30, py + 1.5); ctx.lineTo(px + pw - 30, py + 1.5); ctx.stroke();

    var ry = py + 34;
    rows.forEach(function (row, idx) {
      ctx.textAlign = "left";
      ctx.font = "400 21px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(row[0], px + 30, ry);
      ctx.textAlign = "right";
      ctx.font = "700 23px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(row[1], px + pw - 30 - (row[2] ? 150 : 0), ry);
      if (row[2]) {                                   // 出界结论徽标
        var bx = px + pw - 30;
        ctx.font = "700 18px sans-serif";
        var bw2 = ctx.measureText(row[2]).width + 26;
        roundRect(ctx, bx - bw2, ry - 21, bw2, 28, 14);
        ctx.strokeStyle = row[3]; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = row[3];
        ctx.fillText(row[2], bx - bw2 / 2, ry);
      }
      if (idx < rows.length - 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 26, ry + 13); ctx.lineTo(px + pw - 26, ry + 13);
        ctx.stroke();
      }
      ry += rh;
    });

    // ---------- 底部：来源 + CTA ----------
    ctx.textAlign = "right";
    ctx.font = "400 15px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.fillText("数据来自 Jones 官方目录", px + pw, py + ph + 22);
    // CTA 胶囊
    var ctaW = 440, ctaH = 56, ctaY = 1180 - ctaH - 14;
    var cg = ctx.createLinearGradient(375 - ctaW / 2, 0, 375 + ctaW / 2, 0);
    cg.addColorStop(0, "#ff6a52"); cg.addColorStop(1, "#e2413e");
    ctx.fillStyle = cg;
    roundRect(ctx, 375 - ctaW / 2, ctaY, ctaW, ctaH, ctaH / 2); ctx.fill();
    ctx.shadowColor = "rgba(226,65,62,0.45)"; ctx.shadowBlur = 22;
    roundRect(ctx, 375 - ctaW / 2, ctaY, ctaW, ctaH, ctaH / 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.textAlign = "center";
    ctx.font = "800 26px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("来测测你的本命板 →", 375, ctaY + 37);

    // ---------- 圆角海报裁切 ----------
    ctx.globalCompositeOperation = "destination-in";
    roundRect(ctx, 0, 0, 750, 1180, 36);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.textAlign = "left";
    return cv;
  }

  function saveCard() {
    if (!state.lastResult) return;
    var r = state.lastResult;
    var img = new Image();
    function finish(cv) {
      var dataUri = cv.toDataURL("image/png");
      var mt = window.xhs && window.xhs.miniTool;
      if (mt && mt.saveImageToPhotosAlbum) {
        shareCard(mt, r, dataUri);
      } else {
        toast("保存与分享需在小红书 App 内打开使用");
      }
    }
    img.onload = function () { finish(drawCard(r, img)); };
    img.onerror = function () { finish(drawCard(r, null)); };
    if (r.model.img) img.src = r.model.img;
    else finish(drawCard(r, null));
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
