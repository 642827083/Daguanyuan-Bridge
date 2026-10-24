import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import build from '../scripts/build-web.js';

function native(...names) {
  const context = { console, JSB: { defineClass() { return {}; } } };
  vm.createContext(context);
  for (const name of names) vm.runInContext(readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8'), context);
  return context;
}
function page(address, focus = false) {
  const { document, Event } = parseHTML('<html><head></head><body><li data-learning-question-id="1214">'
    + (focus ? '<div data-focus-question-metadata><button data-question-source>2024年 数一 第1题</button></div>'
      : '<article data-learning-question-card><header><div><strong>1</strong><button data-question-source>2024年 数一 第1题</button></div></header></article>')
    + '</li></body></html>');
  const timers = [], location = new URL(address);
  const window = { document, location, innerHeight: 700, addEventListener() {}, localStorage: { getItem() { return 'complete'; } }, setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {} };
  const context = { window, document, location, URL, URLSearchParams, Event, console, setTimeout: window.setTimeout, MutationObserver: class { observe() {} } };
  vm.createContext(context);
  return { context, document, window, flush() { for (let i = 0; timers.length && i < 10; i++) timers.shift()(); } };
}

test('单题工具与选题导入复用同一识别器，切题和 CSS 隐藏在两个入口同时生效', () => {
  const run = page('https://www.cxyonly.fans/math/practice/categories/345', true);
  run.document.defaultView.HTMLElement.prototype.scrollIntoView = function () {};
  const tools = native('DaguanyuanWebsiteBridge').__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(tools.practiceScript(true, false), run.context); run.flush();
  const shared = run.window.__DAGUANYUAN_QUESTION_DOM__;
  vm.runInContext(build.pageScript(), run.context);
  assert.equal(run.window.__DAGUANYUAN_QUESTION_DOM__, shared);
  const row = run.document.querySelector('[data-learning-question-id]');
  row.setAttribute('data-learning-question-id', '843');
  run.window.__DAGUANYUAN_QUESTION_TOOLS__.schedule(); run.flush();
  run.document.querySelector('#dgy-toolbar [data-scope="selected"]').dispatchEvent(new run.context.Event('click', { bubbles: true }));
  const snapshot = JSON.parse(run.window.__DAGUANYUAN_IMPORT_UI__.pageSnapshot());
  assert.deepEqual(snapshot.questions.map(q => q.id), [843]);
  assert.equal(run.document.querySelector('[data-daguanyuan-practice-locate-card]').getAttribute('data-daguanyuan-practice-locate-card'), '843');
  run.window.getComputedStyle = node => node.style;
  row.style.display = 'none';
  run.window.__DAGUANYUAN_QUESTION_TOOLS__.schedule(); run.flush();
  assert.equal(shared.read().questions.length, 0);
  assert.equal(run.document.querySelector('[data-daguanyuan-question-target]'), null);
});

for (const [path, focus] of [
  ['/math/practice/categories/345', false],
  ['/math/practice?listId=exam&categoryId=836', true],
  ['/math/practice?scope=core&categoryIds=345', true],
]) test('新版练题页恢复三个题目按钮和选题导入：' + path, () => {
  const run = page('https://www.cxyonly.fans' + path, focus);
  const tools = native('DaguanyuanWebsiteBridge').__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(tools.practiceScript(true, true), run.context);
  vm.runInContext(tools.singleImportScript(true), run.context);
  run.flush();
  assert.equal(run.document.querySelectorAll('[data-daguanyuan-question-target]').length, 3);
  run.document.querySelector('[data-daguanyuan-single-import]').dispatchEvent(new run.context.Event('click', { bubbles: true }));
  const payload = JSON.parse(decodeURIComponent(run.document.querySelector('iframe').src.split('payload=')[1]));
  assert.equal(payload.id, 1214); assert.equal(payload.provider, 'math');
  vm.runInContext(build.pageScript(), run.context);
  assert.equal(run.document.querySelector('#dgy-toolbar').hidden, false);
});

test('新版题目定位读取题单标识与网址范围，导入上下文保持精简', () => {
  const run = page('https://www.cxyonly.fans/math/practice?listId=exam&categoryId=836&examSubject=math_2&scope=complete&q=极限&sort=question_id');
  const tools = native('DaguanyuanWebsiteBridge').__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  const value = JSON.parse(vm.runInContext(tools.importContextScript(), run.context));
  assert.deepEqual(value.selection, { listId: 'exam' });
  assert.equal(value.scope, 'complete');
});

test('智能组卷题目显示三个工具，切题后每个按钮使用最新题目 ID，开关独立生效', () => {
  const run = page('https://www.cxyonly.fans/math/paper?view=practice');
  const tools = native('DaguanyuanWebsiteBridge').__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(tools.practiceScript(true, true), run.context);
  vm.runInContext(tools.singleImportScript(true), run.context); run.flush();
  assert.equal(run.document.querySelectorAll('[data-daguanyuan-question-target]').length, 3);
  const row = run.document.querySelector('[data-learning-question-id]');
  row.setAttribute('data-learning-question-id', '843');
  run.window.__DAGUANYUAN_QUESTION_TOOLS__.schedule(); run.flush();
  for (const [selector, command] of [
    ['[data-daguanyuan-practice-locate-card]', 'locate-card?id=843'],
    ['[data-daguanyuan-practice-add-note]', 'add-note?id=843'],
    ['[data-daguanyuan-single-import]', 'import-single?payload=']
  ]) {
    const button = run.document.querySelector(selector);
    assert.equal(JSON.parse(button.getAttribute('data-daguanyuan-question-target')).id, 843);
    button.dispatchEvent(new run.context.Event('click', { bubbles: true }));
    assert.ok(run.document.querySelector('iframe').src.includes(command));
    if (command.startsWith('import-single')) {
      const payload = JSON.parse(decodeURIComponent(run.document.querySelector('iframe').src.split('payload=')[1]));
      assert.equal(payload.id, 843); assert.equal(payload.url, run.window.location.href);
    }
    run.document.querySelector('iframe').remove();
    const state = run.window.__DAGUANYUAN_QUESTION_TOOLS__;
    state.finishLocate(); state.finishNotePaste(); state.finishImport(); run.flush();
  }
  vm.runInContext(tools.practiceScript(false, true), run.context); run.flush();
  assert.equal(run.document.querySelectorAll('[data-daguanyuan-question-target]').length, 2);
  vm.runInContext(tools.singleImportScript(false), run.context); run.flush();
  assert.equal(run.document.querySelectorAll('[data-daguanyuan-question-target]').length, 1);
  run.window.location = new URL('https://www.cxyonly.fans/math');
  run.window.__DAGUANYUAN_QUESTION_TOOLS__.schedule(); run.flush();
  assert.equal(run.document.querySelectorAll('[data-daguanyuan-question-target]').length, 0);
});

test('旧卡查看原题和新版单题链接均可读取，外站仍拒绝', () => {
  const source = native('DaguanyuanSourceLink').__DAGUANYUAN_SOURCE_LINK_GLOBAL__;
  for (const url of ['https://www.cxyonly.fans/math/practice/321?resumeCategoryId=345', 'https://www.cxyonly.fans/math/practice/categories/345?questionId=1214']) {
    const link = source.link('math', 1214, url);
    assert.equal(source.parse(link.replace('marginnote4app://addon/', '')).url, url);
  }
  assert.throws(() => source.link('math', 1, 'https://evil.example/math/practice/categories/345'), /无效/);
});

test('新版分类网址和题单分类可以解析', () => {
  const routes = native('DaguanyuanCategoryRoutes').__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__;
  routes.replaceCatalog(JSON.parse(readFileSync(new URL('./fixtures/math-category-catalog.json', import.meta.url), 'utf8')));
  assert.equal(routes.categoryIdFromURL('https://www.cxyonly.fans/math/practice/categories/345'), 345);
  assert.equal(routes.categoryIdFromURL('https://www.cxyonly.fans/math/practice?listId=core&categoryId=345'), 345);
  assert.equal(routes.categoryIdFromURL('https://www.cxyonly.fans/math/practice/concepts/345'), 0);
  assert.equal(routes.importContextFromURL('https://cxyonly.fans/math/practice/core-math-2/326/566').categoryId, 566);
});

for (const path of ['/math/practice/concepts/345', '/math/practice/exam-by-year-math-2/all/345', '/math/practice/core-math-2/326/566']) test('新版分类页两个导入入口均可用，并保存完整分类取题上下文：' + path, () => {
  const run = page('https://www.cxyonly.fans' + path);
  vm.runInContext(build.pageScript(), run.context);
  assert.equal(run.document.querySelector('[data-import-current]').disabled, false);
  const selected = run.document.querySelector('[data-scope="selected"]');
  selected.dispatchEvent(new run.context.Event('click', { bubbles: true }));
  const snapshot = JSON.parse(run.window.__DAGUANYUAN_IMPORT_UI__.pageSnapshot());
  if (path.includes('/concepts/')) { assert.equal(snapshot.importContext.conceptId, 345); assert.equal(snapshot.importContext.categoryId, 0); }
  else if (path.includes('/core-math-2/')) {
    assert.equal(snapshot.importContext.categoryId, 566); assert.equal(snapshot.importContext.scope, 'core'); assert.equal(snapshot.importContext.examSubject, 'math_2');
  } else { assert.equal(snapshot.importContext.categoryId, 345); assert.equal(snapshot.importContext.scope, 'exam'); assert.equal(snapshot.importContext.examSubject, 'math_2'); }
});

test('数学分类选题读取未加载分页再确认，仅下载所选题目详情', async () => {
  const context = native('DaguanyuanMathSelection');
  const calls = [];
  Object.assign(context, {
    __DAGUANYUAN_MATH_API_GLOBAL__: {
      async practiceQuestionPage(route, page) { calls.push(['page', page, route.scope, route.examSubject]); return { total: 2, pageSize: 1, questions: [{ id: page === 1 ? 1214 : 843 }] }; },
      async categoryRecords(scope, subject) { calls.push(['catalog', scope, subject]); return [[345, 0, '积分']]; }
    },
    __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__: { replaceCatalog() {} },
    __DAGUANYUAN_MATH_IMPORT_GLOBAL__: {
      selectQuestions(questions, ids) { return questions.filter(q => ids.includes(q.id)); },
      preparedMathSession() { return { check() {}, async importQuestions(ids) { assert.deepEqual(Array.from(ids), [843]); return { createdCount: 1, failed: [] }; } }; },
    },
  });
  const confirm = async plan => { assert.deepEqual(Array.from(plan.questions, q => q.id), [1214, 843]); return [843]; }; confirm.check = () => {};
  const result = await context.__DAGUANYUAN_MATH_SELECTION_GLOBAL__.importPage({}, {
    provider: 'math', url: 'https://www.cxyonly.fans/math/practice/categories/345?scope=exam&examSubject=math_2',
    questions: [{ id: 1214 }], importContext: { categoryId: 345, scope: 'exam', examSubject: 'math_2' },
  }, null, confirm);
  assert.equal(result.createdCount, 1);
  assert.deepEqual(calls, [['page', 1, 'exam', 'math_2'], ['page', 2, 'exam', 'math_2'], ['catalog', 'complete', 'all']]);
});

test('新版分类按每页 30 题定位第 38 题，依据网址范围而非旧缓存', () => {
  const panel = native('WebPanelController').__DAGUANYUAN_WEB_PANEL_GLOBAL__;
  const run = page('https://www.cxyonly.fans/math/practice/categories/345?scope=core&page=2');
  run.document.body.innerHTML = Array.from({ length: 30 }, (_, i) => '<li data-learning-question-id="' + (100 + i) + '"></li>').join('');
  let scrolled;
  [...run.document.querySelectorAll('li')].forEach((li, i) => { li.scrollIntoView = () => { scrolled = i + 1; }; });
  vm.runInContext(panel.questionLocatorScript({ questionNumber: 38, scope: 'core', modern: true, page: 2, pageSize: 30 }), run.context);
  assert.equal(scrolled, 8);
  assert.equal(run.document.documentElement.getAttribute('data-daguanyuan-bridge-question-locator'), 'success:38');
});

test('当前页选题导入中断时结果包含当前批次已完成的题卡', async () => {
  const context = native('DaguanyuanMathSelection');
  Object.assign(context, {
    __DAGUANYUAN_MATH_API_GLOBAL__: { categoryRecords: async () => [[345, 0, '奇偶']] },
    __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__: { replaceCatalog() {} },
    __DAGUANYUAN_MATH_IMPORT_GLOBAL__: { selectQuestions(q) { return q; }, preparedMathSession() { return { check() {}, importQuestions: async () => { const error = Error('已停止导入'); error.importResult = { createdCount: 1, skippedCount: 0, failed: [] }; throw error; } }; } },
  });
  await assert.rejects(context.__DAGUANYUAN_MATH_SELECTION_GLOBAL__.importPage({}, { provider: 'math', url: 'https://www.cxyonly.fans/math/practice', questions: [{ id: 1 }] }, null, async () => [1]), error => error.importResult.createdCount === 1);
});
