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

test('新版选题导入读取题单、分类、科目和筛选，不使用旧范围覆盖网址', () => {
  const run = page('https://www.cxyonly.fans/math/practice?listId=exam&categoryId=836&examSubject=math_2&scope=complete&q=极限&sort=question_id');
  const tools = native('DaguanyuanWebsiteBridge').__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  const value = JSON.parse(vm.runInContext(tools.importContextScript(), run.context));
  assert.equal(value.selection.listId, 'exam'); assert.equal(value.selection.categoryId, 836);
  assert.equal(value.selection.examSubject, 'math_2'); assert.equal(value.selection.query, '极限');
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
  const routes = native('DaguanyuanCategoryCatalog', 'DaguanyuanCategoryRoutes').__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__;
  assert.equal(routes.categoryIdFromURL('https://www.cxyonly.fans/math/practice/categories/345'), 345);
  assert.equal(routes.categoryIdFromURL('https://www.cxyonly.fans/math/practice?listId=core&categoryId=345'), 345);
});

test('新版选题请求保持题单、后代分类、科目、筛选和顺序，拒绝非法分类', async () => {
  const context = native('DaguanyuanMathApi');
  let address;
  Object.assign(context, {
    NSURL: { URLWithString(url) { address = url; return url; } },
    NSMutableURLRequest: { requestWithURL() { return { setHTTPMethod() {}, setTimeoutInterval() {}, setAllHTTPHeaderFields() {} }; } },
    NSOperationQueue: { mainQueue() {} }, NSJSONSerialization: { JSONObjectWithDataOptions(data) { return data.payload; } },
    NSURLConnection: { sendAsynchronousRequestQueueCompletionHandler(request, queue, completion) { completion({ statusCode: 200 }, { length: 1, payload: { data: { total: 1, items: [{ id: 1214, category_ids: [345, 839], source: '题目', stem: '题干' }] } } }, null); } },
  });
  const api = context.__DAGUANYUAN_MATH_API_GLOBAL__;
  const value = await api.selectedQuestionPage({ listId: 'exam', categoryId: 836, scope: 'complete', examSubject: 'math_2', query: '极限', sort: 'question_id' }, 2);
  const params = new URL(address).searchParams;
  assert.equal(params.get('question_list_id'), 'exam'); assert.equal(params.get('include_children'), 'true');
  assert.equal(params.get('category_id'), '836'); assert.equal(params.get('exam_subject'), 'math_2');
  assert.equal(params.get('q'), '极限'); assert.equal(params.get('sort'), 'question_id');
  assert.equal(value.questions[0].id, 1214); assert.equal(value.questions[0].categoryId, 345);
  assert.throws(() => api.selectedQuestionPage({ categoryIds: '1,bad', scope: 'complete' }, 1), /分类 ID/);
});

test('选题导入只写勾选项并保留各题所属分类，取消和列表变化不写入', async () => {
  for (const scenario of ['selected', 'cancelled', 'changed']) {
    const context = native('DaguanyuanMathSelection'), writes = [], requests = [];
    const questions = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, categoryIds: [345 + i % 2], source: '题目 ' + (i + 1), stem: '题干' }));
    Object.assign(context, {
      __DAGUANYUAN_MATH_API_GLOBAL__: { categoryRecords: async () => [[345, 0, '奇偶'], [346, 0, '有界']],
        selectedQuestionPage: async (selection, page) => { requests.push(page); return { total: scenario === 'changed' && page === 2 ? 22 : 23, pageSize: 20, questions: questions.slice((page - 1) * 20, page * 20) }; } },
      __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__: { replaceCatalog() {}, resultForCategoryId(id) { return { status: 'resolved', categoryId: id, path: ['分类'] }; } },
      __DAGUANYUAN_MATH_IMPORT_GLOBAL__: { selectQuestions(items, selected) { return items.filter(q => selected.includes(q.id)); }, preparedMathSession() { return { check() {}, targetTitle: '学习集',
        async importQuestions(ids, categories, content) { writes.push({ ids: Array.from(ids), categories: { ...categories }, content }); return { createdCount: ids.length, answerAddedCount: 0, skippedCount: 0, failed: [] }; } }; } },
    });
    const confirmation = async plan => { assert.equal(plan.questions.length, 23); return scenario === 'cancelled' ? false : [2, 23]; };
    confirmation.check = () => {}; confirmation.content = 'questionAnswer';
    const operation = context.__DAGUANYUAN_MATH_SELECTION_GLOBAL__.importSource({}, { scope: 'complete', listId: 'exam' }, () => {}, confirmation);
    if (scenario === 'changed') { await assert.rejects(operation, /列表已变化/); assert.equal(writes.length, 0); continue; }
    const result = await operation;
    assert.deepEqual(requests, [1, 2]);
    if (scenario === 'cancelled') { assert.equal(writes.length, 0); assert.equal(result.cancelled, true); }
    else { assert.deepEqual(writes, [{ ids: [2, 23], categories: { 2: 346, 23: 345 }, content: 'questionAnswer' }]); assert.equal(result.createdCount, 2); }
  }
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

test('网页登录列表请求只读取同站接口，沿用登录状态，切换账户后拒绝迟到结果', async () => {
  for (const changed of [false, true]) {
    const run = page('https://www.cxyonly.fans/math/practice?listId=exam'), calls = [];
    let auth = 'test-session', respond;
    run.window.localStorage.getItem = () => auth;
    run.context.AbortController = AbortController; run.context.clearTimeout = () => {};
    run.window.fetch = (url, options) => { calls.push({ url, options }); return new Promise(resolve => { respond = resolve; }); };
    vm.runInContext(build.pageScript(), run.context);
    const ui = run.window.__DAGUANYUAN_IMPORT_UI__;
    ui.loading('task', 'selected');
    assert.throws(() => ui.sourceBegin('task', 'https://example.com/api/questions?page=1'), /接口地址无效/);
    ui.sourceBegin('task', 'https://www.cxyonly.fans/api/questions?question_list_id=exam-1&page=1');
    assert.equal(calls[0].url, '/api/questions?question_list_id=exam-1&page=1');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer test-session');
    if (changed) auth = 'another-session';
    respond({ ok: true, json: async () => ({ data: { total: 1, items: [{ id: 1 }] } }) });
    await new Promise(resolve => setImmediate(resolve));
    const value = JSON.parse(ui.sourceRead('task'));
    assert.equal(value.status, changed ? 'error' : 'ready');
    assert.doesNotMatch(ui.sourceRead('task'), /test-session|another-session/);
    ui.sourceRelease('task');
  }
});

test('选题导入中断时结果包含当前批次已完成的题卡', async () => {
  const context = native('DaguanyuanMathSelection');
  Object.assign(context, {
    __DAGUANYUAN_MATH_API_GLOBAL__: { categoryRecords: async () => [[345, 0, '奇偶']], selectedQuestionPage: async () => ({ total: 1, pageSize: 20, questions: [{ id: 1, categoryIds: [345] }] }) },
    __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__: { replaceCatalog() {}, resultForCategoryId() { return { status: 'resolved', path: ['分类'] }; } },
    __DAGUANYUAN_MATH_IMPORT_GLOBAL__: { selectQuestions(q) { return q; }, preparedMathSession() { return { check() {}, importQuestions: async () => { const error = Error('已停止导入'); error.importResult = { createdCount: 1, skippedCount: 0, failed: [] }; throw error; } }; } },
  });
  await assert.rejects(context.__DAGUANYUAN_MATH_SELECTION_GLOBAL__.importSource({}, {}, null, async () => [1]), error => error.importResult.createdCount === 1);
});
