/* 計算ロジック（表示から独立・W の整数で計算）
 * state = { on: {id: bool}, mode: {id: modeId}, watts: {id: {modeId: W}} }
 */
(function (root) {
  var LIMIT_W = 3000; // 30A ≒ 3,000W（100V 換算の簡易目安）
  var WARN_W = 2700;  // 27pt 以上は「余裕小」表示（安全境界ではない）

  function findMode(app, modeId) {
    for (var i = 0; i < app.modes.length; i++) if (app.modes[i].id === modeId) return app.modes[i];
    return app.modes[0];
  }

  function selectedModeId(app, state) {
    return findMode(app, state.mode && state.mode[app.id]).id;
  }

  function modeWatts(app, modeId, state) {
    var m = findMode(app, modeId);
    var o = state && state.watts && state.watts[app.id];
    var w = o && typeof o[m.id] === 'number' ? o[m.id] : m.watts;
    return Math.max(0, Math.round(w));
  }

  // 稼働中の機器ごとの W（1 機器 1 モードだけ＝排他）
  function activeItems(apps, state) {
    var out = [];
    apps.forEach(function (app) {
      if (!state.on[app.id]) return;
      var mid = selectedModeId(app, state);
      out.push({ id: app.id, modeId: mid, watts: modeWatts(app, mid, state) });
    });
    return out;
  }

  function totalWatts(apps, state) {
    return activeItems(apps, state).reduce(function (s, it) { return s + it.watts; }, 0);
  }

  // 「これを動かしたら？」：state は変更しない
  function previewChange(apps, state, id, modeId) {
    var next = {
      on: Object.assign({}, state.on),
      mode: Object.assign({}, state.mode),
      watts: state.watts
    };
    next.on[id] = true;
    next.mode[id] = modeId;
    var before = totalWatts(apps, state);
    var after = totalWatts(apps, next);
    return { before: before, after: after, delta: after - before, next: next };
  }

  function toPoints(w) { return (w / 100).toFixed(2); }

  function level(w) {
    if (w > LIMIT_W) return 'over';
    if (w >= WARN_W) return 'warn';
    return 'ok';
  }

  var Calc = {
    LIMIT_W: LIMIT_W, WARN_W: WARN_W,
    findMode: findMode, selectedModeId: selectedModeId, modeWatts: modeWatts,
    activeItems: activeItems, totalWatts: totalWatts, previewChange: previewChange,
    toPoints: toPoints, level: level,
    remaining: function (w) { return LIMIT_W - w; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Calc;
  else root.Calc = Calc;
})(this);
