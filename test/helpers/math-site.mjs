import fs from 'node:fs';

const siteSource = fs.readFileSync(new URL('../../src/DaguanyuanMathSite.js', import.meta.url), 'utf8');

// 独立加载插件脚本的模拟宿主，也加载 main.js 规定的真实网址规则依赖。
export function withMathSite(source) {
  return typeof source === 'string' && source.includes('__DAGUANYUAN_MATH_SITE_GLOBAL__')
    && !source.includes('function createMathSite()') ? siteSource + '\n' + source : source;
}
