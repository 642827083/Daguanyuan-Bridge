import { withMathSite } from './helpers/math-site.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import build from '../scripts/build-web.js';

const read = path => withMathSite(fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const tick = () => new Promise(resolve => setImmediate(resolve));

function browser(address, fetcher) {
  const requests = [], storage = new Map([['daguan_token', 'web-session:fixture'], ['daguan_user', '{"id":27,"math_exam_subject":"math_2"}']]);
  const { document } = parseHTML('<html><head></head><body><header data-learning-question-practice-toolbar><h1><button aria-label="选择题目分类" title="基本概念题">基本概念题</button></h1></header><article class="question-document" data-question-id="2801">题干</article></body></html>');
  const context = { URL, URLSearchParams, document, location: new URL(address), localStorage: { getItem: key => storage.get(key) || null },
    AbortController, setTimeout, clearTimeout, console, navigator: {},
    fetch: async (url, options) => { requests.push({ url, options }); return fetcher ? fetcher(url, options) : { status: 200, ok: true, json: async () => [{ id: 1, parent_id: null, name: '数学', children: [] }] }; },
  };
  context.window = context; vm.createContext(context);
  return { context, requests, storage };
}

test('新数学站已登录时，真实网页与原生分类读取链路可以更新分类，凭据留在网页内', async () => {
  const run = browser('https://math.cxyonly.fans/');
  const native = vm.createContext({ __DAGUANYUAN_MATH_CATALOG_PAGE_SCRIPT__: read('web/src/DaguanyuanMathCatalogPage.js'),
    NSTimer: { scheduledTimerWithTimeInterval(seconds, repeat, callback) { const handle = setTimeout(callback, 1); return { invalidate() { clearTimeout(handle); } }; } },
  });
  for (const name of ['DaguanyuanImportSelection', 'DaguanyuanMathApi']) vm.runInContext(read('src/' + name + '.js'), native);
  const scripts = [], controller = { webView: { evaluateJavaScript(script, callback) {
    scripts.push(script); try { callback(vm.runInContext(script, run.context), null); } catch (error) { callback(null, error); }
  } } };
  const result = await native.__DAGUANYUAN_MATH_API_GLOBAL__.categoryRecords('complete', 'all', controller);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), [[1, 0, '数学']]);
  assert.equal(run.requests[0].url, '/api/categories?scope=complete&exam_subject=all');
  assert.equal(run.requests[0].options.credentials, 'same-origin');
  assert.equal(run.requests[0].options.headers.Authorization, 'Bearer web-session:fixture');
  assert.doesNotMatch(scripts.join('\n'), /web-session:fixture/);
});

for (const path of ['/practice?listId=core-math-2&categoryId=4&scope=core', '/practice/core-math-2/all/4?scope=core', '/practice/categories/4?scope=core']) {
  test('新数学站分类网址可识别题目、题单和当前分类：' + path, () => {
    const run = browser('https://math.cxyonly.fans' + path);
    for (const name of ['DaguanyuanCategoryRoutes', 'DaguanyuanWebsiteBridge']) vm.runInContext(read('src/' + name + '.js'), run.context);
    const bridge = run.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
    vm.runInContext(bridge.questionDOMScript(), run.context);
    const page = run.context.__DAGUANYUAN_QUESTION_DOM__.read();
    assert.equal(page.page.provider, 'math'); assert.equal(page.page.supported, true);
    assert.equal(page.questions[0].id, 2801);
    const current = JSON.parse(vm.runInContext(bridge.bindingContextScript(), run.context));
    assert.equal(current.categoryId, 4); assert.equal(current.selection.listId, 'core-math-2');
  });
}

test('新版分类地址和旧题卡地址解析到同一分类，新建原题链接使用新数学站', () => {
  const context = vm.createContext({}); vm.runInContext(read('src/DaguanyuanCategoryRoutes.js'), context);
  const routes = context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__;
  routes.replaceCatalog({ records: [[1, 0, '数学'], [4, 1, '基本概念题']] });
  for (const address of ['https://math.cxyonly.fans/practice/categories/4', 'https://www.cxyonly.fans/math/practice/categories/4']) {
    assert.equal(routes.importContextFromURL(address).categoryId, 4);
  }
  assert.equal(routes.urlFor(routes.resultForCategoryId(4)), 'https://math.cxyonly.fans/practice/categories/4');
});

test('新数学站选题入口及网页快照沿用实际题目，不因新路径隐藏工具', () => {
  const run = browser('https://math.cxyonly.fans/practice?categoryId=4&scope=core&examSubject=math_2');
  run.context.MutationObserver = class { observe() {} };
  run.context.addEventListener = () => {};
  run.context.innerHeight = 700;
  vm.runInContext(build.pageScript(), run.context);
  assert.equal(run.context.document.querySelector('#dgy-toolbar').hidden, false);
});

test('新域名的原题与问AI链接合法，外站和伪装子域名仍被拒绝', () => {
  const context = vm.createContext({}); vm.runInContext(read('src/DaguanyuanSourceLink.js'), context);
  const api = context.__DAGUANYUAN_SOURCE_LINK_GLOBAL__;
  const link = api.link('math', 2801, 'https://math.cxyonly.fans/practice/categories/4?questionId=2801');
  const result = api.parse(link.slice('marginnote4app://addon/'.length));
  assert.equal(result.questionId, 2801);
  for (const address of ['https://math.cxyonly.fans.evil.test/practice/categories/4', 'https://evil.cxyonly.fans/practice/categories/4', 'http://math.cxyonly.fans/practice/categories/4']) {
    assert.throws(() => api.link('math', 2801, address));
  }
});

test('新数学站的规范化题单路径能按真实题目ID滚动定位', () => {
  const run = browser('https://math.cxyonly.fans/practice/core-math-2/all/4?listRevision=7&scope=core&examSubject=math_2&questionId=2801');
  let scrolled = false;
  run.context.document.querySelector('article').scrollIntoView = () => { scrolled = true; };
  const native = vm.createContext({ JSB: { defineClass() {} } });
  vm.runInContext(read('src/WebPanelController.js'), native);
  vm.runInContext(native.__DAGUANYUAN_WEB_PANEL_GLOBAL__.questionLocatorScript({ imported: true, questionId: 2801,
    questionNumber: 0, listId: 'core-math-2', listRevision: 7, categoryId: 4, scope: 'core', examSubject: 'math_2', page: 1 }), run.context);
  assert.equal(scrolled, true);
  assert.match(run.context.document.documentElement.getAttribute('data-daguanyuan-bridge-question-locator'), /^success:/);
});

test('新版单题导入验证新数学站地址，继续拒绝其他来源', () => {
  const native = vm.createContext({ __DAGUANYUAN_MATH_API_GLOBAL__: { positiveInteger: Number } });
  vm.runInContext(read('src/DaguanyuanSingleImport.js'), native);
  const api = native.__DAGUANYUAN_SINGLE_IMPORT_GLOBAL__;
  for (const url of ['https://math.cxyonly.fans/practice/core-math-2/all/4', 'https://math.cxyonly.fans/questions/2801']) {
    const target = api.targetFromAddress('daguanyuanbridge://import-single?payload=' + encodeURIComponent(JSON.stringify({ provider: 'math', id: 2801, url })));
    assert.equal(target.id, 2801);
  }
  assert.throws(() => api.targetFromAddress('daguanyuanbridge://import-single?payload=' + encodeURIComponent(JSON.stringify({ provider: 'math', id: 2801, url: 'https://evil.test/questions/2801' }))));
});

test('新数学站图片读取和掌握状态模块接受已登录页面', async () => {
  const run = browser('https://math.cxyonly.fans/questions/2801', async () => new Promise(() => {}));
  vm.runInContext(read('web/src/DaguanyuanMathImagePage.js'), run.context);
  assert.equal(run.context.__DAGUANYUAN_MATH_IMAGE_PAGE__.begin('image', 'a'.repeat(64)), 'accepted');
  run.context.__DAGUANYUAN_MATH_IMAGE_PAGE__.release('image');
  vm.runInContext(read('web/src/DaguanyuanMasteryPage.js'), run.context);
  assert.equal(run.context.__DAGUANYUAN_MASTERY_PAGE__.begin('mastery', 2801, 'mastered', 'math'), 'ok');
  await tick();
  assert.equal(run.requests.length, 2);
  assert.match(run.requests[1].url, /^\/api\/retest\/queue\?/);
  assert.equal(run.requests[1].options.headers.Authorization, 'Bearer web-session:fixture');
  run.context.__DAGUANYUAN_MASTERY_PAGE__.release('mastery');
});

test('分类读取仍拒绝未登录、非HTTPS和伪装域名，不会向外站发送凭据', () => {
  for (const address of ['http://math.cxyonly.fans/', 'https://math.cxyonly.fans.evil.test/', 'https://evil.cxyonly.fans/']) {
    const run = browser(address);
    vm.runInContext(read('web/src/DaguanyuanMathCatalogPage.js'), run.context);
    assert.throws(() => run.context.__DAGUANYUAN_MATH_CATALOG_PAGE__.begin('bad', 'complete', 'all'), /不是大观园数学站/);
    assert.equal(run.requests.length, 0);
  }
  const run = browser('https://math.cxyonly.fans/'); run.storage.clear();
  vm.runInContext(read('web/src/DaguanyuanMathCatalogPage.js'), run.context);
  assert.throws(() => run.context.__DAGUANYUAN_MATH_CATALOG_PAGE__.begin('anonymous', 'complete', 'all'), /登录/);
  assert.equal(run.requests.length, 0);
});
