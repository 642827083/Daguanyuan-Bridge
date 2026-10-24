import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import build from '../scripts/build-web.js';
const tick = () => new Promise(resolve => setImmediate(resolve));
const source = name => readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8');
function page(url, html = '') {
  const { document, Event } = parseHTML('<html><head></head><body>' + html + '</body></html>');
  const timers = [], location = { href: url }; let observe;
  const window = { innerHeight: 700, document, addEventListener() {}, getComputedStyle(node) { return node.style; } };
  const context = { window, document, location, URL, URLSearchParams, Event, console, setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {},
    MutationObserver: class { constructor(fn) { observe = fn; } observe() {} } };
  vm.runInNewContext(build.pageScript(), context);
  const api = window.__DAGUANYUAN_IMPORT_UI__;
  const button = document.querySelector('#dgy-toolbar [data-scope="selected"]');
  return { document, location, api, button, click() { button.dispatchEvent(new Event('click', { bubbles: true })); },
    changed() { observe(); timers.shift()?.(); }, snapshot() { return JSON.parse(api.pageSnapshot()); } };
}
const mathRows = '<li data-learning-question-id="31"><article class="question-document" data-question-id="31"><button data-question-source>2024年 第1题</button>题干甲<button>添加笔记</button></article></li>'
  + '<section hidden><article class="question-document" data-question-id="9">隐藏题</article></section>'
  + '<article class="question-document" data-question-id="22" style="margin-top:3000px">题干乙</article>'
  + '<li data-retest-question-id="45">复测题</li>';
for (const path of ['/math/paper', '/math/practice', '/math/retest']) test('当前网页题目按 DOM 顺序获取、去重、排除隐藏题，含滚动区域外题目：' + path, () => {
  const run = page('https://www.cxyonly.fans' + path, mathRows);
  assert.equal(run.button.disabled, false); run.click();
  const snapshot = run.snapshot();
  assert.deepEqual(snapshot.questions.map(q => q.id), [31, 22, 45]);
  assert.equal(snapshot.questions[0].title, '2024年 第1题');
  assert.equal(snapshot.questions[0].summary, '题干甲');
  run.document.querySelector('[data-question-id="22"]').setAttribute('data-question-id', '99');
  run.api.loading('test', 'selected');
  assert.deepEqual(run.snapshot().questions.map(q => q.id), [31, 22, 45]);
  run.location.href += '?next=1'; assert.throws(() => run.snapshot(), /切换/);
});
test('智能组卷单题展示仅导入当前可见题目，隐藏旧题不入选', () => {
  const run = page('https://www.cxyonly.fans/math/paper', '<article hidden class="question-document" data-question-id="1">旧题</article><article class="question-document" data-question-id="2">当前题</article>');
  run.click(); assert.deepEqual(run.snapshot().questions.map(q => q.id), [2]);
});
for (const origin of ['https://www.cxyonly.fans/', 'https://www.408os.cn/overview']) test('无题目保留入口且禁用，异步加载完成后自动可用：' + origin, () => {
  const run = page(origin); assert.equal(run.document.querySelector('#dgy-toolbar').hidden, false);
  assert.equal(run.button.disabled, true); assert.match(run.button.title, /暂无/);
  run.click(); assert.throws(() => run.snapshot(), /切换/);
  run.document.body.insertAdjacentHTML('afterbegin', origin.includes('408') ? '<div class="question-card"><span class="year-tag">2010年</span><span class="index-tag">第17题</span>题干</div>' : '<article class="question-document" data-question-id="2">题干</article>');
  run.changed(); assert.equal(run.button.disabled, false); run.click(); assert.equal(run.snapshot().questions.length, 1);
});
test('408 题本按页面顺序识别真实题号，不读取隐藏题或额外分类题', () => {
  const card = (year, number, hidden = '') => '<div class="question-card" ' + hidden + '><span class="year-tag">' + year + '年</span><span class="index-tag">第' + number + '题</span>题干</div>';
  const run = page('https://www.408os.cn/exercise?mode=collection&collectionId=4', card(2010, 17) + card(2012, 43) + card(2013, 2, 'hidden'));
  run.click(); assert.deepEqual(run.snapshot().questions.map(q => q.id), [64, 184]);
});
function mathNative() {
  const writes = [], events = [];
  const context = { console,
    __DAGUANYUAN_MATH_API_GLOBAL__: { async categoryRecords() { events.push('categories'); return []; }, selectedQuestionPage() { throw Error('禁止读取范围分页'); } },
    __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__: { replaceCatalog() {} },
    __DAGUANYUAN_MATH_IMPORT_GLOBAL__: { selectQuestions(q, ids) { return q.filter(q => ids.includes(q.id)); }, preparedMathSession() { return { check() {}, targetTitle: '学习集',
      async importQuestions(ids, categories, content) { writes.push({ ids: Array.from(ids), categories: { ...categories }, content }); return { createdCount: ids.length, failed: [] }; } }; } }
  };
  vm.runInNewContext(source('DaguanyuanMathSelection'), context);
  return { api: context.__DAGUANYUAN_MATH_SELECTION_GLOBAL__, writes, events, context };
}
test('数学当前页导入先确认再取详情，只写所选题，保留网页次序及答案模式', async () => {
  const run = mathNative(), browser = page('https://www.cxyonly.fans/math/paper', mathRows); browser.click();
  const confirm = async plan => { run.events.push('confirm'); assert.deepEqual(Array.from(plan.questions, q => q.id), [31, 22, 45]); return [45, 31]; };
  confirm.content = 'questionAnswer'; confirm.check = () => {};
  const result = await run.api.importPage({}, browser.snapshot(), null, confirm);
  assert.equal(result.createdCount, 2); assert.deepEqual(run.events, ['confirm', 'categories']);
  assert.deepEqual(run.writes, [{ ids: [31, 45], categories: {}, content: 'questionAnswer' }]);
});
test('数学当前页取消不读取分类和题目；重复编号拒绝导入', async () => {
  const run = mathNative(), snapshot = { provider: 'math', url: 'https://www.cxyonly.fans/math/paper', questions: [{ id: 31 }] };
  const confirm = async () => false; confirm.check = () => {};
  assert.equal((await run.api.importPage({}, snapshot, null, confirm)).cancelled, true);
  assert.deepEqual(run.events, []); assert.deepEqual(run.writes, []);
  assert.throws(() => run.api.importPage({}, { ...snapshot, questions: [{ id: 31 }, { id: 31 }] }, null, confirm), /编号/);
});
for (const provider of ['math', '408']) test('真实面板 bridge 选题入口读取网页快照，不走分类整类导入：' + provider, async () => {
  let methods; const calls = [];
  const snapshot = { provider, url: provider === 'math' ? 'https://www.cxyonly.fans/math/paper' : 'https://www.408os.cn/exercise?year=2010', questions: [{ id: 64 }] };
  const controller = { currentContentPage: provider, addon: {}, webView: { evaluateJavaScript(s, cb) { cb(true); } } };
  const result = { total: 1, createdCount: 1, failed: [] };
  const context = { console, self: controller, JSB: { defineClass(n, v) { methods = v; return {}; } },
    __DAGUANYUAN_WEB_BRIDGE_COMMANDS_GLOBAL__: { handle(ctx) { ctx.openCategory('selected'); } },
    __DAGUANYUAN_IMPORT_REPORT_GLOBAL__: { textFor() { return ''; } },
    __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__: { begin(c) { return c.importTask = { ready: Promise.resolve() }; }, confirmation() { const f = () => {}; f.check = () => {}; return f; },
      async evaluate(c, script) { assert.equal(script, 'window.__DAGUANYUAN_IMPORT_UI__.pageSnapshot()'); return JSON.stringify(snapshot); }, async show() {} },
    __DAGUANYUAN_MATH_SELECTION_GLOBAL__: { async importPage(addon, page) { calls.push(page); return result; } },
    __DAGUANYUAN_408_IMPORT_GLOBAL__: { async importCategory(c, p, single, confirm, page) { assert.equal(single, null); calls.push(page); return result; } }
  };
  vm.runInNewContext(source('WebPanelController'), context);
  methods.webViewShouldStartLoadWithRequestNavigationType(controller.webView, { URL: { absoluteString: 'daguanyuanbridge://ui?payload=test' } });
  await tick(); assert.deepEqual(JSON.parse(JSON.stringify(calls)), [snapshot]); assert.equal(controller.categoryImportBusy, false);
});
