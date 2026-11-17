// node test_calc.js — 受け入れ条件（計算部分）の確認
const C = require('./calc.js');
const g = {}; (function(){ eval(require('fs').readFileSync(__dirname + '/data.js','utf8')); }).call(g);
const A = g.APP_DATA.APPLIANCES;
let fail = 0;
const eq = (name, got, exp) => { const ok = got === exp; if (!ok) fail++; console.log((ok?'OK  ':'NG  ') + name + ' => ' + got + (ok?'':' (期待 '+exp+')')); };
const S = (on, mode={}) => ({ on, mode, watts: {} });

let s = S({ heater: true });
eq('ヒーターのみ', C.toPoints(C.totalWatts(A, s)), '12.50');

s = S({ stove: true, pc: true, heater: true, base: true }, { stove: 'normal', pc: 'high' });
eq('基準状態 W', C.totalWatts(A, s), 2087);
eq('基準状態 pt', C.toPoints(C.totalWatts(A, s)), '20.87');

const snap = JSON.stringify(s);
let p = C.previewChange(A, s, 'dishwasher', 'on');
eq('食洗機プレビュー 後W', p.after, 3252);
eq('食洗機プレビュー 後pt', C.toPoints(p.after), '32.52');
eq('食洗機プレビュー 超過W', -C.remaining(p.after), 252);
eq('食洗機プレビュー level', C.level(p.after), 'over');
eq('プレビューで元状態が不変', JSON.stringify(s), snap);

p = C.previewChange(A, s, 'cooker', 'on');
eq('圧力鍋プレビュー 後W', p.after, 2787);
eq('圧力鍋プレビュー pt', C.toPoints(p.after), '27.87');
eq('圧力鍋プレビュー 残りW', C.remaining(p.after), 213);
eq('圧力鍋プレビュー level', C.level(p.after), 'warn');

const s2 = S({ pc: true }, { pc: 'mid' });
p = C.previewChange(A, s2, 'pc', 'high');
eq('PC 中→高 増加分', p.delta, 200);

eq('レンジ/オーブン排他', C.totalWatts(A, S({ microwave: true }, { microwave: 'oven' })), 1240);
eq('ストーブ点火 排他', C.totalWatts(A, S({ stove: true }, { stove: 'ignite' })), 860);
eq('W 編集が反映', C.totalWatts(A, { on: { base: true }, mode: {}, watts: { base: { on: 350 } } }), 350);
eq('3000 ちょうどは over でない', C.level(3000), 'warn');
console.log(fail ? `\n${fail} 件 NG` : '\n全件 OK');
process.exit(fail ? 1 : 0);
