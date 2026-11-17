/* 家電の初期データ（ここを書き換えれば一覧が変わる）
 * modes が複数ある機器は「同じ機器の排他モード」。二重加算しない。
 * color はキャンディの色。
 */
(function (root) {
  var APPLIANCES = [
    { id: 'heater', name: '寝室パネルヒーター', icon: '🛏️', color: '#ff8fab',
      modes: [{ id: 'on', label: 'ON', watts: 1250 }] },
    { id: 'stove', name: '灯油ストーブ', icon: '🔥', color: '#ffb347',
      modes: [{ id: 'normal', label: '通常', watts: 37 }, { id: 'ignite', label: '点火時', watts: 860 }] },
    { id: 'pc', name: 'PC（本体）', icon: '💻', color: '#7cc4ea',
      modes: [{ id: 'mid', label: '中', watts: 400 }, { id: 'high', label: '高', watts: 600 }] },
    { id: 'dishwasher', name: '食洗機', icon: '🍽️', color: '#86dbb8',
      modes: [{ id: 'on', label: 'ON', watts: 1165 }] },
    { id: 'microwave', name: '電子レンジ', icon: '♨️', color: '#b9a0f7',
      modes: [{ id: 'range', label: 'レンジ', watts: 1450 }, { id: 'oven', label: 'オーブン', watts: 1240 }] },
    { id: 'toaster', name: 'トースター', icon: '🍞', color: '#ffd166',
      modes: [{ id: 'on', label: 'ON', watts: 1300 }] },
    { id: 'cooker', name: '電気圧力鍋', icon: '🍲', color: '#f4978e',
      modes: [{ id: 'on', label: 'ON', watts: 700 }] },
    { id: 'washer', name: '洗濯機', icon: '🧺', color: '#9db8ff',
      modes: [{ id: 'on', label: 'モーター定格', watts: 140 }] },
    { id: 'base', name: '冷蔵庫・照明など', icon: '💡', color: '#d4b8e0',
      modes: [{ id: 'on', label: '概算', watts: 200 }] }
  ];

  // 「おすすめ初期状態」：ストーブ通常＋PC 中＋冷蔵庫・照明など
  var DEFAULT_ON = { stove: true, pc: true, base: true };
  var DEFAULT_MODE = { stove: 'normal', pc: 'mid' };

  root.APP_DATA = { APPLIANCES: APPLIANCES, DEFAULT_ON: DEFAULT_ON, DEFAULT_MODE: DEFAULT_MODE };
})(this);
