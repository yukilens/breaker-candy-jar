/* 画面（描画とイベント）。計算は calc.js、家電データは data.js */
(function () {
  'use strict';
  var A = APP_DATA.APPLIANCES;
  var C = Calc;
  var KEY = 'breaker-candy-jar:v1';
  var byId = {};
  A.forEach(function (a) { byId[a.id] = a; });

  var state = load();
  var editMode = false;
  var preview = null; // { id, modeId }

  // ---------- 保存 ----------
  function defaults() {
    return { on: Object.assign({}, APP_DATA.DEFAULT_ON), mode: Object.assign({}, APP_DATA.DEFAULT_MODE), watts: {} };
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var d = JSON.parse(raw);
        return { on: d.on || {}, mode: d.mode || {}, watts: d.watts || {} };
      }
    } catch (e) { /* 保存領域が使えなくても動かす */ }
    return defaults();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* noop */ }
  }

  // ---------- 表示ヘルパ ----------
  var fmt = function (n) { return Math.abs(n).toLocaleString('en-US'); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  function statusText(w) {
    var rem = C.remaining(w);
    if (rem < 0) return '上限目安を ' + fmt(rem) + 'W 超過';
    if (C.level(w) === 'warn') return '目安上はあと ' + fmt(rem) + 'W（余裕小）';
    return '目安上はあと ' + fmt(rem) + 'W';
  }

  // ---------- キャンディジャー（SVG） ----------
  // 1 粒 = 1pt = 100W。端数は小さい粒（面積比）。
  function candyList(items) {
    var out = [], c = 0;
    items.forEach(function (it) {
      var w = it.watts;
      var n = 0;
      while (w > 0) {
        var s = Math.min(100, w);
        out.push({ key: (it.key || '') + ':' + (n++), center: (c + s / 2) / 100, size: s / 100, color: it.color, ghost: !!it.ghost });
        c += s; w -= s;
      }
    });
    return out;
  }

  function geom(cols, rows, s) {
    var iw = cols * s, ih = rows * s;
    var bodyL = s * 0.5, bodyR = bodyL + iw + s, cx = (bodyL + bodyR) / 2;
    var g = {
      s: s, cols: cols, rows: rows, iw: iw, bodyL: bodyL, bodyR: bodyR, cx: cx,
      nL: cx - iw * 0.3, nR: cx + iw * 0.3,
      neckTop: s * 2.0, shoulder: s * 2.9, yCap: s * 3.9
    };
    g.yb = g.yCap + ih;
    g.bodyBottom = g.yb + s * 0.35;
    g.footBottom = g.bodyBottom + s * 1.5;
    g.x0 = bodyL + s * 0.5;
    g.width = bodyR + s * 0.5;
    g.height = g.footBottom + s * 0.3;
    return g;
  }

  function bodyPath(g) {
    var s = g.s;
    return 'M' + g.nL + ',' + g.neckTop + ' L' + g.nL + ',' + g.shoulder +
      ' C' + g.bodyL + ',' + g.shoulder + ' ' + g.bodyL + ',' + (g.shoulder + s * 0.1) + ' ' + g.bodyL + ',' + (g.shoulder + s * 0.9) +
      ' L' + g.bodyL + ',' + (g.bodyBottom - s) +
      ' Q' + g.bodyL + ',' + g.bodyBottom + ' ' + (g.bodyL + s) + ',' + g.bodyBottom +
      ' L' + (g.bodyR - s) + ',' + g.bodyBottom +
      ' Q' + g.bodyR + ',' + g.bodyBottom + ' ' + g.bodyR + ',' + (g.bodyBottom - s) +
      ' L' + g.bodyR + ',' + (g.shoulder + s * 0.9) +
      ' C' + g.bodyR + ',' + (g.shoulder + s * 0.1) + ' ' + g.bodyR + ',' + g.shoulder + ' ' + g.nR + ',' + g.shoulder +
      ' L' + g.nR + ',' + g.neckTop + ' Z';
  }

  function lidSVG(g) {
    var s = g.s, rx = (g.nR - g.nL) / 2 + s * 0.3, y = g.neckTop;
    return '<g class="lid">' +
      '<path class="glass" d="M' + (g.cx - rx) + ',' + y + ' Q' + g.cx + ',' + (y - s * 1.5) + ' ' + (g.cx + rx) + ',' + y + ' Z"/>' +
      '<ellipse class="glass" cx="' + g.cx + '" cy="' + y + '" rx="' + rx + '" ry="' + s * 0.22 + '"/>' +
      '<rect class="glass" x="' + (g.cx - s * 0.12) + '" y="' + (y - s * 1.05) + '" width="' + s * 0.24 + '" height="' + s * 0.35 + '"/>' +
      '<ellipse class="glass" cx="' + g.cx + '" cy="' + (y - s * 1.35) + '" rx="' + s * 0.28 + '" ry="' + s * 0.38 + '"/>' +
      '</g>';
  }

  function footSVG(g) {
    var s = g.s, cx = g.cx;
    return '<path class="glass" d="M' + (cx - s * 0.7) + ',' + g.bodyBottom + ' L' + (cx - s * 0.28) + ',' + (g.footBottom - s * 0.3) +
      ' L' + (cx + s * 0.28) + ',' + (g.footBottom - s * 0.3) + ' L' + (cx + s * 0.7) + ',' + g.bodyBottom + ' Z"/>' +
      '<ellipse class="glass" cx="' + cx + '" cy="' + (g.bodyBottom + s * 0.6) + '" rx="' + s * 0.42 + '" ry="' + s * 0.28 + '"/>' +
      '<ellipse class="glass" cx="' + cx + '" cy="' + (g.footBottom - s * 0.25) + '" rx="' + g.iw * 0.3 + '" ry="' + s * 0.25 + '"/>';
  }

  function candiesSVG(list, g, maxRows, posOut) {
    var s = g.s, html = '';
    list.forEach(function (cd, i) {
      var row = Math.floor(cd.center / g.cols);
      if (row >= maxRows) return;
      var col = cd.center - row * g.cols;
      var jx = (((i * 37) % 5) - 2) * s * 0.04, jy = (((i * 53) % 5) - 2) * s * 0.04;
      var x = g.x0 + col * s + jx, y = g.yb - (row + 0.5) * s + jy;
      var r = Math.max(s * 0.13, s * 0.47 * Math.sqrt(cd.size));
      var cls = 'candy' + (cd.ghost ? ' ghost' : '') + (row >= g.rows ? ' spill' : '');
      if (posOut) posOut[cd.key] = { x: x, y: y, i: i };
      html += '<g class="' + cls + '" data-k="' + cd.key + '"><circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="' + r.toFixed(2) + '" fill="' + cd.color + '"/>' +
        '<circle class="shine" cx="' + (x - r * 0.35).toFixed(2) + '" cy="' + (y - r * 0.35).toFixed(2) + '" r="' + (r * 0.3).toFixed(2) + '"/></g>';
    });
    return html;
  }

  function jarSVG(opt) {
    var g = geom(opt.cols, opt.rows, opt.s);
    var top = -(opt.topPad || 0);
    var html = '<svg viewBox="0 ' + top + ' ' + g.width + ' ' + (g.height - top) + '" class="jar ' + (opt.cls || '') + '" aria-hidden="true">' +
      '<path class="glass back" d="' + bodyPath(g) + '"/>' + footSVG(g);
    if (opt.capLine) {
      html += '<line class="cap" x1="' + (g.bodyL + g.s * 0.3) + '" x2="' + (g.bodyR - g.s * 0.3) + '" y1="' + g.yCap + '" y2="' + g.yCap + '"/>' +
        '<text class="cap-label" x="' + (g.bodyR - g.s * 0.35) + '" y="' + (g.yCap - g.s * 0.2) + '" font-size="' + g.s * 0.6 + '" text-anchor="end">30</text>';
    }
    html += candiesSVG(candyList(opt.items), g, opt.rows + (opt.extraRows || 0), opt.posOut);
    if (opt.geomOut) opt.geomOut.g = g;
    html += '<path class="glass front" d="' + bodyPath(g) + '"/>' +
      '<path class="hl" d="M' + (g.bodyL + g.s * 0.45) + ',' + (g.shoulder + g.s * 1.3) + ' L' + (g.bodyL + g.s * 0.45) + ',' + (g.bodyBottom - g.s * 1.2) + '"/>' +
      lidSVG(g) + '</svg>';
    return html;
  }

  // ---------- 降ってきて溜まる演出 ----------
  // 新しい粒＝ジャーの口から順に落下して着地。位置が変わった粒＝下へ詰める。
  var prevPos = {};
  var pourUntil = 0, pourTimer = null;
  var reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function animateJar(pos, g) {
    var svgs = Array.prototype.slice.call(document.querySelectorAll('#mainJar svg, #miniJar svg'));
    var old = prevPos;
    prevPos = pos;
    if (reduceMotion || !svgs.length || !svgs[0].animate || !g) return;
    var keys = Object.keys(pos).sort(function (a, b) { return pos[a].i - pos[b].i; });
    var drops = 0, lastEnd = 0, topY = -30;
    keys.forEach(function (k) {
      var els = svgs.map(function (s) { return s.querySelector('[data-k="' + k + '"]'); }).filter(Boolean);
      if (!els.length) return;
      var el = { animate: function (f, o) { els.forEach(function (e) { e.animate(f, o); }); } };
      var p = pos[k], o = old[k];
      if (!o) {
        var delay = Math.min(drops * 55, 1400);
        var dur = 520 + Math.min(260, (p.y - topY) * 1.2);
        var dx = g.cx - p.x + (((drops * 29) % 7) - 3) * 1.5;
        var dy = topY - p.y;
        el.animate([
          { transform: 'translate(' + dx + 'px,' + dy + 'px)', opacity: 0, easing: 'linear' },
          { transform: 'translate(' + dx * 0.9 + 'px,' + dy * 0.93 + 'px)', opacity: 1, offset: 0.08, easing: 'cubic-bezier(.5,0,.85,.6)' },
          { transform: 'translate(0px,0px)', offset: 0.72, easing: 'ease-out' },
          { transform: 'translate(0px,-4px) scale(1.06,.94)', offset: 0.86, easing: 'ease-in' },
          { transform: 'translate(0px,0px)' }
        ], { duration: dur, delay: delay, fill: 'backwards' });
        drops++;
        lastEnd = Math.max(lastEnd, delay + dur);
      } else if (Math.abs(o.x - p.x) > 0.5 || Math.abs(o.y - p.y) > 0.5) {
        el.animate([
          { transform: 'translate(' + (o.x - p.x) + 'px,' + (o.y - p.y) + 'px)', easing: 'cubic-bezier(.5,0,.8,.5)' },
          { transform: 'translate(0px,0px)', offset: 0.8, easing: 'ease-out' },
          { transform: 'translate(0px,-2px)', offset: 0.9 },
          { transform: 'translate(0px,0px)' }
        ], { duration: 420 });
      }
    });
    if (drops) {
      pourUntil = Date.now() + lastEnd;
      svgs.forEach(function (s) { s.classList.add('pouring'); });
      clearTimeout(pourTimer);
      pourTimer = setTimeout(function () {
        document.querySelectorAll('#mainJar svg, #miniJar svg').forEach(function (s) { s.classList.remove('pouring'); });
      }, lastEnd);
    }
  }

  // ---------- 描画 ----------
  var $ = function (id) { return document.getElementById(id); };
  function setAll(sel, text, cls) {
    document.querySelectorAll(sel).forEach(function (el) { el.textContent = text; if (cls) el.className = cls; });
  }
  var jarVisible = true;
  function showJar() { // プレビュー時は大きいジャーが見える位置へ
    if (!jarVisible) window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function render() {
    var total = C.totalWatts(A, state);
    var lv = C.level(total);
    setAll('.js-pt', C.toPoints(total));
    setAll('.js-watts', fmt(total) + 'W / ' + fmt(C.LIMIT_W) + 'W');
    setAll('.js-status', statusText(total), 'status js-status ' + lv);
    document.body.dataset.level = lv;

    // メインのジャー（プレビュー中は「追加後」をうすい粒で）
    var items, jarTotal = total;
    if (preview) {
      var p = C.previewChange(A, state, preview.id, preview.modeId);
      jarTotal = p.after;
      items = C.activeItems(A, p.next).filter(function (i) { return i.id !== preview.id; })
        .map(function (i) { return { key: i.id, watts: i.watts, color: byId[i.id].color }; });
      items.push({ key: preview.id, watts: C.modeWatts(byId[preview.id], preview.modeId, state), color: byId[preview.id].color, ghost: true });
    } else {
      items = C.activeItems(A, state).map(function (i) { return { key: i.id, watts: i.watts, color: byId[i.id].color }; });
    }
    var jl = C.level(jarTotal);
    var pos = {}, go = {};
    var jarHtml = jarSVG({ cols: 6, rows: 5, s: 16, items: items, capLine: true, extraRows: 3, topPad: 34,
      posOut: pos, geomOut: go,
      cls: 'main lv-' + jl + (jl === 'over' ? ' popped' : '') + (Date.now() < pourUntil ? ' pouring' : '') });
    $('mainJar').innerHTML = jarHtml;
    $('miniJar').innerHTML = jarHtml;
    animateJar(pos, go.g);
    $('jarCaption').textContent = preview ? 'うすい粒＝追加分（予測）' : '1粒 = 1pt = 100W';

    // 使用中リスト
    var act = C.activeItems(A, state);
    $('using').innerHTML = '<span class="k">使用中</span>' + (act.length ? act.map(function (i) {
      var a = byId[i.id], m = C.findMode(a, i.modeId);
      return '<span class="pill" style="--c:' + a.color + '">' + esc(a.name) + (a.modes.length > 1 ? '（' + esc(m.label) + '）' : '') + ' ' + fmt(i.watts) + 'W</span>';
    }).join('') : '<span class="none">なし</span>');

    renderGrid();
    renderSheet();
    $('editToggle').textContent = editMode ? '編集を終える' : 'W を編集';
    $('editToggle').setAttribute('aria-pressed', editMode);
    $('editExtra').hidden = !editMode;
    document.body.classList.toggle('editing', editMode);
  }

  function renderGrid() {
    $('grid').innerHTML = A.map(function (a) {
      var on = !!state.on[a.id];
      var mid = C.selectedModeId(a, state);
      var w = C.modeWatts(a, mid, state);
      var maxPt = Math.max.apply(null, a.modes.map(function (m) { return C.modeWatts(a, m.id, state); })) / 100;
      var rows = Math.min(4, Math.max(3, Math.ceil(maxPt / 5)));
      var chips = a.modes.length > 1 ? '<div class="modes" role="group" aria-label="モード">' + a.modes.map(function (m) {
        var sel = m.id === mid;
        return '<button class="chip' + (sel ? ' sel' : '') + '" data-act="mode" data-id="' + a.id + '" data-mode="' + m.id + '" aria-pressed="' + sel + '">' +
          esc(m.label) + '<small>' + fmt(C.modeWatts(a, m.id, state)) + 'W</small></button>';
      }).join('') + '</div>' : '';
      var edit = '<div class="edit">' + a.modes.map(function (m) {
        return '<label>' + (a.modes.length > 1 ? esc(m.label) : 'W') + '<input type="number" inputmode="numeric" min="0" max="20000" step="1" data-act="watts" data-id="' + a.id + '" data-mode="' + m.id + '" value="' + C.modeWatts(a, m.id, state) + '">' + (a.modes.length > 1 ? 'W' : '') + '</label>';
      }).join('') + '</div>';
      var whatIf = on ? '' : '<button class="whatif" data-act="whatif" data-id="' + a.id + '">もし動かしたら？</button>';
      return '<div class="card' + (on ? ' on' : '') + (preview && preview.id === a.id ? ' previewing' : '') + '" style="--c:' + a.color + '">' +
        '<button class="card-main" data-act="toggle" data-id="' + a.id + '" aria-pressed="' + on + '">' +
          '<span class="mini">' + jarSVG({ cols: 5, rows: rows, s: 10, items: [{ watts: w, color: a.color }], extraRows: 1, cls: 'mini-jar' }) + '</span>' +
          '<span class="badge">' + (on ? '使用中' : 'OFF') + '</span>' +
          '<span class="name"><span class="ic">' + a.icon + '</span>' + esc(a.name) + '</span>' +
          '<span class="nums"><b>' + fmt(w) + 'W</b><span>' + C.toPoints(w) + 'pt</span></span>' +
        '</button>' + chips + whatIf + edit + '</div>';
    }).join('');
  }

  function renderSheet() {
    var sh = $('sheet');
    if (!preview) { sh.hidden = true; sh.innerHTML = ''; return; }
    var a = byId[preview.id];
    var isOn = !!state.on[a.id];
    var curMode = C.selectedModeId(a, state);
    var p = C.previewChange(A, state, a.id, preview.modeId);
    var lv = C.level(p.after);
    var same = isOn && curMode === preview.modeId;
    var chips = a.modes.length > 1 ? '<div class="modes">' + a.modes.map(function (m) {
      var sel = m.id === preview.modeId;
      return '<button class="chip' + (sel ? ' sel' : '') + '" data-act="pmode" data-mode="' + m.id + '" aria-pressed="' + sel + '">' +
        esc(m.label) + (isOn && m.id === curMode ? '（いま）' : '') + '<small>' + fmt(C.modeWatts(a, m.id, state)) + 'W</small></button>';
    }).join('') + '</div>' : '';
    var sign = p.delta >= 0 ? '+' : '−';
    var msg = lv === 'over' ? '⚠ 上限目安を ' + fmt(C.remaining(p.after)) + 'W 超過（見込み）' : statusText(p.after);
    sh.innerHTML =
      '<div class="sheet-in">' +
      '<div class="sheet-title"><span class="ic">' + a.icon + '</span>「' + esc(a.name) + '」' + (isOn ? 'のモードを変えたら？' : 'を動かしたら？') + '</div>' +
      chips +
      '<div class="cmp">' +
        '<div><span class="k">いま</span><b>' + fmt(p.before) + 'W</b><span class="pt">' + C.toPoints(p.before) + ' / 30</span></div>' +
        '<div class="arrow">→</div>' +
        '<div class="after lv-' + lv + '"><span class="k">' + (isOn ? '変更後' : '追加後') + '</span><b>' + fmt(p.after) + 'W</b><span class="pt">' + C.toPoints(p.after) + ' / 30</span></div>' +
      '</div>' +
      '<div class="delta">' + sign + fmt(p.delta) + 'W（' + sign + C.toPoints(Math.abs(p.delta)) + 'pt）</div>' +
      '<div class="msg lv-' + lv + '">' + msg + '</div>' +
      '<div class="sheet-btns">' +
        '<button class="primary" data-act="commit"' + (same ? ' disabled' : '') + '>' + (same ? 'いまのモード' : isOn ? 'このモードに切り替え' : '使用中に追加') + '</button>' +
        '<button data-act="close">閉じる</button>' +
      '</div></div>';
    sh.hidden = false;
  }

  // ---------- 操作 ----------
  function onClick(e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.dataset.act, id = t.dataset.id;
    if (act === 'toggle') {
      if (editMode) return;
      state.on[id] = !state.on[id];
      if (preview && preview.id === id) preview = null;
      save();
    } else if (act === 'mode') {
      if (editMode) return;
      if (state.on[id]) {
        if (t.dataset.mode === C.selectedModeId(byId[id], state)) return;
        preview = { id: id, modeId: t.dataset.mode }; // 使用中ならまずプレビュー
        showJar();
      } else {
        state.mode[id] = t.dataset.mode; save();
        if (preview && preview.id === id) preview.modeId = t.dataset.mode;
      }
    } else if (act === 'whatif') {
      preview = { id: id, modeId: C.selectedModeId(byId[id], state) };
      showJar();
    } else if (act === 'pmode') {
      preview.modeId = t.dataset.mode;
    } else if (act === 'commit') {
      state.on[preview.id] = true;
      state.mode[preview.id] = preview.modeId;
      preview = null; save();
    } else if (act === 'close') {
      preview = null;
    } else return;
    render();
  }

  function onChange(e) {
    var t = e.target;
    if (t.dataset.act !== 'watts') return;
    var v = Math.round(Number(t.value));
    if (!isFinite(v) || v < 0 || v > 20000 || t.value === '') { render(); return; }
    var id = t.dataset.id;
    state.watts[id] = state.watts[id] || {};
    state.watts[id][t.dataset.mode] = v;
    save(); render();
  }

  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && preview) { preview = null; render(); } });

  $('allOff').addEventListener('click', function () { state.on = {}; preview = null; save(); render(); });
  $('resetDefault').addEventListener('click', function () {
    var d = defaults(); state.on = d.on; state.mode = d.mode; preview = null; save(); render();
  });
  $('editToggle').addEventListener('click', function () { editMode = !editMode; preview = null; render(); });
  $('resetWatts').addEventListener('click', function () {
    if (!confirm('編集した W をすべて初期値に戻します。よろしいですか？')) return;
    state.watts = {}; save(); render();
  });

  // 背景テーマ（見る人ごとの好み。保存できなくても既定の beige で動く）
  var THEME_KEY = 'breaker-candy-jar:theme';
  var THEME_COLOR = { beige: '#f2ebdf', pink: '#fff0f5', blue: '#eef5fd' };
  function applyTheme(name) {
    if (!THEME_COLOR[name]) name = 'beige';
    if (name === 'beige') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = name;
    document.querySelector('meta[name="theme-color"]').setAttribute('content', THEME_COLOR[name]);
    document.querySelectorAll('[data-theme-pick]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.themePick === name);
    });
  }
  document.querySelectorAll('[data-theme-pick]').forEach(function (b) {
    b.addEventListener('click', function () {
      applyTheme(b.dataset.themePick);
      try { localStorage.setItem(THEME_KEY, b.dataset.themePick); } catch (e) { /* noop */ }
    });
  });
  applyTheme(document.documentElement.dataset.theme || 'beige');

  // 大きいジャーが画面から外れたら、上に小さいバーを出す
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      jarVisible = es[0].intersectionRatio >= 0.35;
      document.body.classList.toggle('show-mini', !jarVisible);
    }, { threshold: [0, 0.35, 1] }).observe($('mainJar'));
  }

  render();
})();
