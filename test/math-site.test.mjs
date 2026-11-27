import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import build from '../scripts/build-web.js';

const source = () => fs.readFileSync(new URL('../src/DaguanyuanMathSite.js', import.meta.url), 'utf8');
function runtime() { const context = vm.createContext({}); vm.runInContext(source(), context); return context.__DAGUANYUAN_MATH_SITE_GLOBAL__; }

test('数学网址规则在无 URL、DOM 的原生环境与注入网页中保持一致', () => {
  const native = runtime(), browser = vm.createContext({ window: {} });
  vm.runInContext(native.pageScript(), browser);
  const web = browser.__DAGUANYUAN_MATH_SITE_GLOBAL__;
  for (const host of ['math.cxyonly.fans', 'www.cxyonly.fans', 'cxyonly.fans']) {
    const prefix = host === 'math.cxyonly.fans' ? '' : '/math';
    for (const path of ['/practice', '/practice/categories/42', '/practice/concepts/42', '/practice/core-math-2/all/42', '/questions/2345', '/paper', '/retest/practice']) {
      const address = 'https://' + host + prefix + path + '?scope=core#part';
      assert.equal(JSON.stringify(native.page(address)), JSON.stringify(web.page(address)));
      assert.equal(native.supports(address, 'tools'), true);
      assert.equal(native.supports(address, 'note'), true);
    }
  }
});

test('不同操作保留各自页面限制，搜索预览由调用方另行校验', () => {
  const site = runtime();
  assert.equal(site.supports('https://math.cxyonly.fans/', 'question'), false);
  assert.equal(site.supports('https://math.cxyonly.fans/lists/market', 'note'), false);
  assert.equal(site.supports('https://math.cxyonly.fans/retest/practice', 'question'), false);
  assert.equal(site.supports('https://math.cxyonly.fans/practice/concepts/42', 'binding'), false);
  assert.equal(site.supports('https://math.cxyonly.fans/practice/core-math-2/all/42', 'binding'), true);
  assert.equal(site.supports('https://math.cxyonly.fans/questions/2345?x=1', 'source'), true);
  assert.equal(site.supports('https://math.cxyonly.fans/questions/2345#part', 'source'), false);
  assert.equal(site.supports('https://math.cxyonly.fans/practice/categories/42?q=x', 'category'), false);
});

test('外站、伪装域名和非 HTTPS 不能通过统一规则或生成可信原题地址', () => {
  const site = runtime();
  for (const address of ['http://math.cxyonly.fans/questions/1', 'https://math.cxyonly.fans.evil.test/questions/1',
    'https://math.cxyonly.fans@evil.test/questions/1', 'https://evil.test@math.cxyonly.fans/questions/1',
    'https://math.cxyonly.fans:8443/questions/1', 'https://math.cxyonly.fans\\@evil.test/questions/1',
    'https://math.cxyonly.fans/questions/1\n', 'https://math.cxyonly.fans/questions/<1>']) {
    assert.equal(site.page(address), null, address);
    assert.equal(site.supports(address, 'question'), false);
    assert.equal(site.questionURL(1, address), '');
  }
});

test('导航兼容旧网址并保留筛选与锚点，原题地址按当前数学站生成', () => {
  const site = runtime();
  assert.equal(site.origin, 'https://math.cxyonly.fans');
  assert.equal(site.navigationURL('https://www.cxyonly.fans/math/practice?listId=core-math-2#part'), site.url('/practice?listId=core-math-2#part'));
  assert.equal(site.navigationURL('https://www.408os.cn/exercise?year=2026'), 'https://www.408os.cn/exercise?year=2026');
  assert.equal(site.questionURL(2345, 'https://www.cxyonly.fans/math'), 'https://www.cxyonly.fans/math/questions/2345');
  assert.equal(site.questionURL(2345, site.origin + '/'), site.origin + '/questions/2345');
  assert.equal(site.questionURL(0), '');
});

test('真实入口先加载数学站规则，再加载所有使用它的插件模块', () => {
  const files = [];
  vm.runInNewContext(fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), { JSB: { require: name => files.push(name) } });
  assert.ok(files.includes('DaguanyuanMathSite'));
  for (const name of files.filter(name => !name.startsWith('web-dist/'))) {
    if (name === 'DaguanyuanMathSite') continue;
    const code = fs.readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8');
    if (code.includes('__DAGUANYUAN_MATH_SITE_GLOBAL__')) assert.ok(files.indexOf('DaguanyuanMathSite') < files.indexOf(name), name);
  }
});

for (const [name, key] of [['DaguanyuanMathCatalogPage.js', '__DAGUANYUAN_MATH_CATALOG_PAGE__'],
  ['DaguanyuanMathImagePage.js', '__DAGUANYUAN_MATH_IMAGE_PAGE__'], ['DaguanyuanMasteryPage.js', '__DAGUANYUAN_MASTERY_PAGE__']]) {
  test('实际打包网页脚本自带共用规则，替换旧网页接收器：' + name, () => {
    const old = {}, window = { location: new URL('https://math.cxyonly.fans/'), [key]: old };
    const context = vm.createContext({ window });
    vm.runInContext(build.mathPageScript(name), context);
    assert.notEqual(window[key], old);
    assert.equal(context.__DAGUANYUAN_MATH_SITE_GLOBAL__.supports(window.location, 'question'), false);
    assert.equal(context.__DAGUANYUAN_MATH_SITE_GLOBAL__.supports('https://www.cxyonly.fans/math/questions/2345', 'question'), true);
    const receiver = window[key]; vm.runInContext(build.mathPageScript(name), context);
    assert.equal(window[key], receiver);
  });
}
