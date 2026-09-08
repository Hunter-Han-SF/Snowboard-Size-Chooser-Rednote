/* 测试辅助：把 main.js 的匹配算法段 + data.js 数据拼成一个可 require 的模块，
   写入系统临时目录（不修改仓库内文件）。用法: node tmp/gen_extract.js */
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'minitool/assets/main.js'), 'utf8');
const algo = src.slice(src.indexOf('/* ---------- 匹配算法'), src.indexOf('/* ---------- 结果渲染'));
const data = fs.readFileSync(path.join(ROOT, 'minitool/assets/data.js'), 'utf8').replace(/window\./g, 'globalThis.');

const dir = path.join(os.tmpdir(), 'node_modules');
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, 'jones_algo_extract.js');
fs.writeFileSync(out,
  '// 自动生成：main.js 算法段 + data.js（测试专用）\n' + data + '\n' + algo +
  '\nmodule.exports = { rangeContains, rangeGap, minWaistForEU, scoreSizes, candidatePool, heightAdjustedIndex, pickBest };\n');

console.log(out);
