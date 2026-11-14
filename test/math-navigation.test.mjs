import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
const directory = () => ({ definition_revision: 7, total: 62, roots: [
  { category_id: 700, label: '二重积分', question_count: 62, children: [
    { category_id: 701, label: '计算', question_count: 39, children: [
      { category_id: 704, label: '直角坐标', question_count: 39, children: [] },
      { category_id: 705, label: '极坐标', question_count: 18, children: [] },
    ] },
  ] },
] });

function runtime(options = {}) {
  const opened = [], messages = [], requests = [];
  let current = { url: 'https://cxyonly.fans/math/practice/core-math-1/all/704?listRevision=7',
    scope: 'complete', examSubject: 'math_1', selection: { listId: 'core-math-1', listRevision: 7 } };
  const controller = { currentContentPage: 'math', addon: {}, webView: {
    evaluateJavaScript(script, callback) { callback(JSON.stringify(current), null); },
  } };
  const context = { console,
    nativeValue(object, key) { const value = object && object[key]; return typeof value === 'function' ? value.call(object) : value; },
    showPanel() {}, loadURL(c, url) { opened.push(url); }, showMessage(c, message) { messages.push(message); },
    __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__: { importContextScript: () => 'context', navigationContextScript: () => 'context' },
    __DAGUANYUAN_MATH_API_GLOBAL__: { questionScope: value => value,
      async questionListDirectory(selection, c, check) { requests.push(plain(selection)); if (check) check(); return options.directory ? options.directory() : directory(); },
      async practiceQuestionPage(selection, page, c, check) { if (check) check(); if (options.questions) return options.questions(selection, page); return { total: 39,
        questions: Array.from({ length: 20 }, (_, i) => ({ id: 301 + (page - 1) * 20 + i })) }; },
      async questionListPosition(selection, id, c, check) { if (check) check(); return options.position ? options.position(selection, id) : { questionId: id, position: 38, page: 2 }; },
      async questionNavigationInfo(id) { return options.info ? options.info(id) : { id, categoryId: 704, categoryIds: [704] }; } },
  };
  vm.createContext(context);
  vm.runInContext(read('src/DaguanyuanCategoryRoutes.js'), context);
  context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.replaceCatalog({ records: [[700, 0, '二重积分'], [701, 700, '计算'], [704, 701, '直角坐标'], [705, 701, '极坐标']] });
  const module = new URL('../src/DaguanyuanMathNavigation.js', import.meta.url);
  if (fs.existsSync(module)) vm.runInContext(fs.readFileSync(module, 'utf8'), context);
  const source = read('src/WebPanelController.js');
  const start = source.indexOf('function startDaguanyuanQuestionLocator(');
  vm.runInContext(source.slice(start, source.indexOf('function open408Question', start)), context);
  const route = { url: 'https://www.cxyonly.fans/math/practice/700?resumeCategoryId=704', categoryId: 704, questionNumber: 38 };
  return { context, controller, opened, messages, requests, route, get current() { return current; }, set current(value) { current = value; } };
}

test('定位题目保留真实题单和备考科目，旧分类链接不再触发网站范围拦截', async () => {
  const run = runtime();
  run.context.openDaguanyuanQuestion(run.controller, run.route);
  await tick();
  assert.equal(run.opened.length, 1);
  const url = new URL(run.opened[0]);
  assert.equal(url.origin, 'https://math.cxyonly.fans');
  assert.equal(url.pathname, '/practice');
  assert.equal(url.searchParams.get('listId'), 'core-math-1');
  assert.equal(url.searchParams.get('listRevision'), '7');
  assert.equal(url.searchParams.get('examSubject'), 'math_1');
  assert.equal(url.searchParams.get('categoryId'), '704');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('questionId'), '338');
  assert.equal(run.controller.pendingQuestionLocator.pageSize, 30);
  assert.equal(run.requests.length, 1);
});

function page(address, html = '', storage = {}) {
  const { document } = parseHTML('<html><body>' + html + '</body></html>');
  const context = { document, URL, URLSearchParams, location: new URL(address), localStorage: { getItem: key => storage[key] || null } };
  context.window = context;
  vm.createContext(context);
  for (const name of ['DaguanyuanCategoryRoutes', 'DaguanyuanWebsiteBridge']) vm.runInContext(read('src/' + name + '.js'), context);
  return { context, document, read() { return JSON.parse(vm.runInContext(context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.navigationContextScript(), context)); } };
}

test('网页读取路径中的题单与版本，不依赖旧范围缓存', () => {
  const run = page('https://cxyonly.fans/math/practice/core-math-1/all/704?listRevision=7', '', { 'daguan:question-bank-scope': 'exam' });
  const result = run.read();
  assert.equal(result.selection.listId, 'core-math-1');
  assert.equal(result.selection.listRevision, 7);
  assert.equal(result.examSubject, 'math_1');
  assert.equal(result.scope, 'complete');
});

test('普通练习入口只读取明确选中的题单链接，不猜菜单里的其他题单', () => {
  const run = page('https://cxyonly.fans/math/practice', '<nav><a aria-current="page" href="/math/lists/core-math-2?revision=9">数二严选</a><a href="/math/lists/complete">完整</a></nav>');
  assert.equal(run.read().selection.listId, 'core-math-2');
  assert.equal(run.read().selection.listRevision, 9);
  assert.equal(run.read().examSubject, 'math_2');
  run.document.querySelector('nav').insertAdjacentHTML('beforeend', '<a aria-current="page" href="/math/lists/core-math-2?revision=9">数二严选</a>');
  assert.equal(run.read().selection.listId, 'core-math-2');
  run.document.querySelectorAll('[aria-current]')[1].remove();
  run.document.querySelector('[aria-current]').removeAttribute('aria-current');
  assert.equal(run.read().selection.listId, '');
});

test('传统侧栏题单通过单选控件表达当前范围，没有题单链接时仍识别数二严选', () => {
  const html = '<nav><a aria-current="page" href="/math">首页</a></nav>'
    + '<div class="learning-shell__scope-toggle" role="group" aria-label="题单，当前严选">'
    + '<button role="radio" aria-checked="false">完整</button>'
    + '<button role="radio" aria-checked="true" data-state="on">严选</button>'
    + '<button role="radio" aria-checked="false">真题</button></div>';
  const run = page('https://cxyonly.fans/math', html, { daguan_user: JSON.stringify({ id: 27, math_exam_subject: 'math_2' }) });
  const value = run.read();
  assert.equal(value.selection.listId, 'core-math-2');
  assert.equal(value.examSubject, 'math_2');
  assert.equal(value.scope, 'core');
});

for (const [label, scope, list] of [['完整', 'complete', 'complete'], ['严选', 'core', 'core'], ['真题', 'exam', 'exam-chapters']]) {
  test('传统侧栏按网站规则选择官方题单：' + label, () => {
    for (const subject of ['all', 'math_1', 'math_2', 'math_3']) {
      for (const mark of ['role="radio" aria-checked="true"', 'aria-pressed="true"']) {
        const run = page('https://cxyonly.fans/math/practice', '<div class="learning-shell__scope-toggle"><button ' + mark + '>' + label + '</button></div>',
          { daguan_user: JSON.stringify({ math_exam_subject: subject }), 'daguan:question-bank-scope': 'wrong-stale-value' });
        assert.equal(run.read().selection.listId, list + (subject === 'all' ? '' : '-' + subject.replace('_', '-')));
        assert.equal(run.read().scope, scope);
      }
    }
  });
}

test('只读实际题单控件，忽略无关按钮和旧缓存，并拒绝相互冲突的选择', () => {
  const run = page('https://cxyonly.fans/math', '<button aria-pressed="true">严选</button>', { 'daguan:question-bank-scope': 'core' });
  assert.equal(run.read().selection.listId, '');
  run.document.body.innerHTML = '<div class="learning-shell__scope-toggle" aria-label="题单，当前严选"><button role="radio" aria-checked="true">完整</button></div>';
  assert.equal(run.read().selection.listId, '');
  run.document.body.innerHTML = '<div class="learning-shell__scope-toggle" aria-label="题单，当前严选"></div>'
    + '<a aria-current="page" href="/math/lists/custom-a">甲</a><a aria-current="page" href="/math/lists/custom-b">乙</a>';
  assert.equal(run.read().selection.listId, '');
});

test('明确的自定义题单优先于侧栏范围控件', () => {
  const run = page('https://cxyonly.fans/math/practice?listId=custom-a&examSubject=math_1',
    '<div class="learning-shell__scope-toggle" aria-label="题单，当前严选"></div>');
  assert.equal(run.read().selection.listId, 'custom-a');
  assert.equal(run.read().scope, 'complete');
});

test('无侧栏的具体分类页按网址明确的范围识别题单，不要求返回首页', () => {
  for (const [scope, list] of [['complete', 'complete'], ['core', 'core'], ['exam', 'exam-chapters']]) {
    const run = page('https://cxyonly.fans/math/practice?categoryId=704&scope=' + scope + '&examSubject=math_2',
      '<header data-learning-question-practice-toolbar><h1>直角坐标</h1></header>');
    assert.equal(run.read().selection.listId, list + '-math-2');
    assert.equal(run.read().scope, scope);
  }
});

test('旧分类地址未指定范围时遵循网站的完整范围，不继承首页的范围缓存', () => {
  const run = page('https://cxyonly.fans/math/practice/categories/704?examSubject=math_2',
    '<header data-learning-question-practice-toolbar><h1>直角坐标</h1></header>', { 'daguan:question-bank-scope': 'core' });
  assert.equal(run.read().selection.listId, 'complete-math-2');
  assert.equal(run.read().scope, 'complete');
});

test('沉浸式分类页从当前练习的返回题单链接读取真实题单及版本', () => {
  const run = page('https://cxyonly.fans/math/practice?categoryId=704',
    '<header data-learning-question-practice-toolbar><a href="/math/lists/custom-a?revision=9&examSubject=math_3&scope=exam" aria-label="返回题单">返回</a></header>'
    + '<nav><a href="/math/lists/custom-b">其他题单</a></nav>');
  const current = run.read();
  assert.equal(current.selection.listId, 'custom-a');
  assert.equal(current.selection.listRevision, 9);
  assert.equal(current.examSubject, 'math_3');
  assert.equal(current.scope, 'exam');
});

test('分类页不会把外站、菜单、市场链接或互相冲突的题单当成当前选择', () => {
  for (const html of [
    '<header data-learning-question-practice-toolbar><a aria-label="返回题单" href="https://example.com/math/lists/core">返回</a></header>',
    '<header data-learning-question-practice-toolbar><a aria-label="返回题单" href="/math/lists/market">返回</a></header>',
    '<nav><a aria-label="返回题单" href="/math/lists/custom-a">其他菜单</a></nav>',
    '<header data-learning-question-practice-toolbar><a aria-label="返回题单" href="/math/lists/custom-a">甲</a><a aria-label="返回题单" href="/math/lists/custom-b">乙</a></header>',
  ]) {
    const run = page('https://cxyonly.fans/math/practice?categoryId=704', html);
    assert.equal(run.read().selection.listId, '');
  }
  const conflict = page('https://cxyonly.fans/math/practice?categoryId=704&scope=core',
    '<div class="learning-shell__scope-toggle" aria-label="题单，当前完整"></div>');
  assert.equal(conflict.read().selection.listId, '');
});

test('从截图对应的数二严选首页执行定位，不再打开题单选择页', async () => {
  const browser = page('https://cxyonly.fans/math',
    '<nav><a aria-current="page" href="/math">首页</a></nav><div class="learning-shell__scope-toggle" aria-label="题单，当前严选">'
      + '<button role="radio" aria-checked="false">完整</button><button role="radio" aria-checked="true">严选</button><button role="radio" aria-checked="false">真题</button></div>',
    { daguan_user: JSON.stringify({ id: 27, math_exam_subject: 'math_2' }) });
  const run = runtime();
  vm.runInContext(read('src/DaguanyuanWebsiteBridge.js'), run.context);
  run.controller.webView.evaluateJavaScript = (script, callback) => {
    try { callback(vm.runInContext(script, browser.context), null); } catch (error) { callback(null, error); }
  };
  await run.context.openDaguanyuanQuestion(run.controller, run.route);
  assert.equal(run.requests[0].listId, 'core-math-2');
  const address = new URL(run.opened[0]);
  assert.equal(address.origin, 'https://math.cxyonly.fans');
  assert.equal(address.pathname, '/practice');
  assert.equal(address.searchParams.get('listId'), 'core-math-2');
  assert.equal(address.searchParams.get('scope'), 'core');
  assert.equal(address.searchParams.get('examSubject'), 'math_2');
  assert.equal(address.searchParams.get('questionId'), '338');
});

test('备考科目优先取网址，其次题单后缀及当前账号设置，读取结果不包含凭据', () => {
  const run = page('https://cxyonly.fans/math/practice?listId=my-list&examSubject=math_3&scope=exam', '', {
    daguan_user: JSON.stringify({ id: 27, math_exam_subject: 'math_2', email: 'private@example.test' }), daguan_token: 'fixture-only-secret',
  });
  assert.equal(run.read().examSubject, 'math_3');
  assert.equal(run.read().scope, 'exam');
  run.context.location = new URL('https://cxyonly.fans/math/lists/my-list');
  assert.equal(run.read().examSubject, 'math_2');
  assert.equal(run.read().ownerKey, '27');
  assert.doesNotMatch(JSON.stringify(run.read()), /fixture-only-secret|private@example/);
});

function retryTimers(run, onWait = () => {}) {
  const waits = [];
  run.context.NSTimer = { scheduledTimerWithTimeInterval(seconds, repeat, callback) {
    waits.push(seconds);
    queueMicrotask(() => { onWait(waits.length); callback(); });
    return { invalidate() {} };
  } };
  return waits;
}

test('一直无法识别题单时有限重试并保留页面，不自动跳转题单市场', async () => {
  const run = runtime();
  run.current = { url: 'https://cxyonly.fans/math/practice', scope: 'complete', selection: {} };
  const waits = retryTimers(run);
  await run.context.openDaguanyuanQuestion(run.controller, run.route);
  assert.deepEqual(run.opened, []);
  assert.ok(waits.length > 0 && waits.length <= 20);
  assert.ok(waits.reduce((total, seconds) => total + seconds, 0) <= 5);
  assert.match(run.messages.at(-1), /题单.*选择|选择.*题单/);
  assert.equal(run.requests.length, 0);
  assert.equal(run.controller.pendingQuestionLocator, undefined);
});

test('侧栏延后加载时重新读取真实严选控件，识别成功后继续原定位', async () => {
  const browser = page('https://cxyonly.fans/math/practice', '', { daguan_user: '{"id":27,"math_exam_subject":"math_1"}' });
  const run = runtime();
  run.controller.webView.evaluateJavaScript = (script, callback) => callback(JSON.stringify(browser.read()), null);
  const waits = retryTimers(run, index => {
    if (index === 3) browser.document.body.innerHTML = '<div class="learning-shell__scope-toggle" aria-label="题单，当前严选"></div>';
  });
  await run.context.openDaguanyuanQuestion(run.controller, run.route);
  assert.equal(waits.length, 3);
  assert.equal(run.opened.length, 1);
  const url = new URL(run.opened[0]);
  assert.equal(url.searchParams.get('listId'), 'core-math-1');
  assert.equal(url.searchParams.get('questionId'), '338');
  assert.equal(run.requests.length, 1);
});

test('等待题单期间定位取消，不再请求目录或跳转页面', async () => {
  const run = runtime();
  run.current = { url: 'https://cxyonly.fans/math', scope: 'complete', selection: {} };
  const waits = retryTimers(run, () => { run.controller.questionLocatorRequestToken += 1; });
  await run.context.openDaguanyuanQuestion(run.controller, run.route);
  assert.equal(waits.length, 1);
  assert.equal(run.requests.length, 0);
  assert.equal(run.opened.length, 0);
});

test('没有原生延迟接口时保留网页并提示选择题单', async () => {
  const run = runtime();
  run.current = { url: 'https://cxyonly.fans/math', scope: 'complete', selection: {} };
  await run.context.openDaguanyuanQuestion(run.controller, run.route);
  assert.equal(run.opened.length, 0);
  assert.equal(run.requests.length, 0);
  assert.match(run.messages.at(-1), /选择.*完整.*严选.*真题/);
});

test('等待期间切换到 408 后停止旧数学定位，不弹出过期错误', async () => {
  const run = runtime();
  run.current = { url: 'https://cxyonly.fans/math', scope: 'complete', selection: {} };
  retryTimers(run, () => { run.controller.currentContentPage = '408'; });
  await run.context.openDaguanyuanQuestion(run.controller, run.route);
  assert.equal(run.opened.length, 0);
  assert.equal(run.requests.length, 0);
  assert.equal(run.messages.length, 1);
  assert.match(run.messages[0], /正在等待/);
});

test('等待题单期间网页变化，不在用户新打开的页面继续旧定位', async () => {
  const run = runtime();
  const selected = run.current;
  run.current = { url: 'https://cxyonly.fans/math', scope: 'complete', selection: {} };
  retryTimers(run, () => { run.current = selected; });
  await run.context.openDaguanyuanQuestion(run.controller, run.route);
  assert.equal(run.requests.length, 0);
  assert.equal(run.opened.length, 0);
  assert.match(run.messages.at(-1), /网页.*变化/);
});

for (const entry of [
  { listId: 'complete-math-3', subject: 'math_3', category: 705, number: 2 },
  { listId: 'exam-chapters-math-2', subject: 'math_2', category: 704, number: 1, scope: 'exam' },
  { listId: 'custom-list-1', subject: 'all', category: 704, number: 30 },
]) test('题单与其他分类通用定位：' + entry.listId, async () => {
  const run = runtime();
  run.current = { url: 'https://cxyonly.fans/math/practice?listId=' + entry.listId, scope: entry.scope || 'complete', examSubject: entry.subject, selection: { listId: entry.listId } };
  await run.context.openDaguanyuanQuestion(run.controller, { ...run.route, categoryId: entry.category, questionNumber: entry.number });
  const url = new URL(run.opened[0]);
  assert.equal(url.searchParams.get('listId'), entry.listId);
  assert.equal(url.searchParams.get('examSubject'), entry.subject);
  assert.equal(url.searchParams.get('categoryId'), String(entry.category));
  assert.equal(url.searchParams.get('practiceOrigin'), 'list');
});

test('分类 ID 改变但路径唯一时从当前题单目录重新对应', async () => {
  const next = directory(); next.roots[0].children[0].children[0].category_id = 1704;
  const run = runtime({ directory: () => next });
  await run.context.openDaguanyuanQuestion(run.controller, run.route);
  assert.equal(new URL(run.opened[0]).searchParams.get('categoryId'), '1704');
});

for (const kind of ['missing', 'ambiguous', 'renamed-id', 'empty']) test('拒绝猜测无效分类：' + kind, async () => {
  const next = directory();
  if (kind === 'missing') next.roots[0].children[0].children.shift();
  if (kind === 'ambiguous') {
    next.roots[0].children[0].children[0].category_id = 1704;
    next.roots.push({ category_id: 800, label: '二重积分', children: [{ category_id: 801, label: '计算', children: [{ category_id: 804, label: '直角坐标', children: [] }] }] });
  }
  if (kind === 'renamed-id') next.roots[0].children[0].children[0].label = '不对应的题型';
  if (kind === 'empty') next.roots = [];
  const run = runtime({ directory: () => next });
  await run.context.openDaguanyuanQuestion(run.controller, run.route);
  assert.equal(run.opened.length, 0);
  assert.match(run.messages[0], /分类|题单/);
});

test('目录题目不足、题单修订变化和接口异常均停止，不跳到其他题单', async () => {
  for (const modify of [d => { d.roots[0].children[0].children[0].question_count = 3; }, d => { d.definition_revision = 8; }, () => { throw Error('当前账号无权访问此题单'); }]) {
    const run = runtime({ directory() { const d = directory(); modify(d); return d; } });
    await run.context.openDaguanyuanQuestion(run.controller, run.route);
    assert.equal(run.opened.length, 0);
    assert.equal(run.messages.length, 1);
  }
});

test('题目实际返回不足时不会用相邻题代替', async () => {
  const run = runtime({ questions: () => ({ total: 37, questions: [] }) });
  await run.context.openDaguanyuanQuestion(run.controller, run.route);
  assert.equal(run.opened.length, 0);
  assert.match(run.messages[0], /无法定位第 38 题/);
});

test('读取期间切换题单或账号后不执行过期跳转', async () => {
  for (const change of [r => { r.current = { ...r.current, url: 'https://cxyonly.fans/math/lists/complete' }; }, r => { r.current = { ...r.current, ownerKey: 'other-account' }; }]) {
    let finish;
    const run = runtime({ directory: () => new Promise(resolve => { finish = resolve; }) });
    const task = run.context.openDaguanyuanQuestion(run.controller, run.route);
    await tick(); change(run); finish(directory()); await task;
    assert.equal(run.opened.length, 0);
    assert.match(run.messages[0], /已变化/);
  }
});

test('连续定位只执行最后一次请求', async () => {
  const pending = [], run = runtime({ directory: () => new Promise(resolve => { pending.push(resolve); }) });
  const first = run.context.openDaguanyuanQuestion(run.controller, run.route);
  await tick();
  const second = run.context.openDaguanyuanQuestion(run.controller, { ...run.route, questionNumber: 2 });
  await tick(); pending[1](directory()); await second; pending[0](directory()); await first;
  assert.equal(run.opened.length, 1);
  assert.equal(new URL(run.opened[0]).searchParams.get('questionId'), '302');
  assert.equal(run.messages.length, 1);
});

test('查看原题在保存的分类中按真实 ID 打开，不退到独立详情页', async () => {
  const run = runtime();
  await run.context.openDaguanyuanQuestion(run.controller, { ...run.route, imported: true, questionNumber: 0, questionId: 2801 });
  const address = new URL(run.opened[0]);
  assert.equal(address.origin, 'https://math.cxyonly.fans');
  assert.equal(address.pathname, '/practice');
  assert.equal(address.searchParams.get('categoryId'), '704');
  assert.equal(address.searchParams.get('questionId'), '2801');
  assert.equal(address.searchParams.get('listId'), 'complete');
  assert.equal(address.searchParams.get('scope'), 'complete');
  assert.equal(address.searchParams.get('page'), '2');
});

test('查看原题无需先选择题单，并且按原题 ID 查询位置，不使用脑图题卡序号', async () => {
  let requested;
  const run = runtime({ questions() { throw Error('查看原题不能按脑图序号取题'); },
    position(selection, id) { requested = { selection: plain(selection), id }; return { questionId: id, position: 82, page: 3 }; } });
  run.current = { url: 'https://cxyonly.fans/math/questions/2801', scope: 'core', examSubject: 'math_2', selection: {} };
  await run.context.openDaguanyuanQuestion(run.controller, { ...run.route, categoryId: undefined,
    url: 'https://cxyonly.fans/math/practice/700?resumeCategoryId=705', imported: true, questionNumber: 2, questionId: 2801 });
  assert.equal(requested.id, 2801);
  assert.equal(requested.selection.categoryId, 705);
  assert.equal(requested.selection.examSubject, 'all');
  const address = new URL(run.opened[0]);
  assert.equal(address.searchParams.get('categoryId'), '705');
  assert.equal(address.searchParams.get('page'), '3');
  assert.equal(address.searchParams.get('questionId'), '2801');
  assert.equal(run.controller.pendingQuestionLocator.imported, true);
});

test('只有原题详情链接的题卡从题目元数据恢复分类', async () => {
  const run = runtime({ info: id => ({ id, categoryId: 705, categoryIds: [705] }) });
  await run.context.openDaguanyuanQuestion(run.controller, { url: 'https://cxyonly.fans/math/questions/2801', imported: true, questionId: 2801 });
  assert.equal(new URL(run.opened[0]).searchParams.get('categoryId'), '705');
});

test('原题不存在于保存的分类或请求失效时不退到独立详情页', async () => {
  for (const fail of ['membership', 'permission']) {
    const run = runtime({ position() { throw Error(fail === 'membership' ? '原题不在保存的题单分类中' : '当前账号无权访问'); } });
    await run.context.openDaguanyuanQuestion(run.controller, { ...run.route, imported: true, questionId: 2801 });
    assert.equal(run.opened.length, 0);
    assert.match(run.messages[0], /原题|无权访问/);
  }
});

test('原题分类练习页按 ID 定位，不点击另一个范围按钮', () => {
  const browser = page('https://cxyonly.fans/math/practice/complete/all/704?listRevision=7&scope=complete&examSubject=all&page=2&questionId=2801',
    '<button aria-pressed="false">完整</button><li data-learning-question-id="2801"></li>');
  let scrolled = false;
  browser.document.querySelector('li').scrollIntoView = () => { scrolled = true; };
  browser.document.querySelector('button').click = () => { throw Error('不能重新切换题单'); };
  const native = { JSB: { defineClass() {} } }; vm.createContext(native); vm.runInContext(read('src/WebPanelController.js'), native);
  browser.context.setTimeout = () => {};
  vm.runInContext(native.__DAGUANYUAN_WEB_PANEL_GLOBAL__.questionLocatorScript({ imported: true, questionId: 2801,
    questionNumber: 0, listId: 'complete', listRevision: 7, categoryId: 704, scope: 'complete', examSubject: 'all', page: 2 }), browser.context);
  assert.equal(scrolled, true);
});

for (const detailOnly of [false, true]) test('查看原题完整网页桥按来源分类读取真实页码，详情链接=' + detailOnly, async () => {
  const browser = page('https://cxyonly.fans/math/questions/2801', '', { daguan_token: 'fixture-source-token' });
  const requests = [], receipts = [], run = runtime();
  Object.assign(browser.context, { setTimeout, clearTimeout, AbortController, fetch: async path => {
    requests.push(path);
    const address = new URL(path, browser.context.location);
    const data = address.pathname.endsWith('/directory') ? directory()
      : address.pathname.endsWith('/position') ? { available: true, question_id: 2801, definition_revision: 7, position: 38, page: 2 }
        : address.pathname.startsWith('/api/questions/') ? { id: 2801, category_id: 704, stem: 'asset://sha256/' + 'a'.repeat(64) }
          : { id: 'complete', revision: 7 };
    return { ok: true, status: 200, json: async () => data };
  } });
  run.context.__DAGUANYUAN_MATH_CATALOG_PAGE_SCRIPT__ = read('web/src/DaguanyuanMathCatalogPage.js');
  run.context.NSTimer = { scheduledTimerWithTimeInterval(seconds, repeat, callback) { const timer = setTimeout(callback, Math.min(seconds * 1000, 1)); return { invalidate() { clearTimeout(timer); } }; } };
  for (const name of ['DaguanyuanWebsiteBridge', 'DaguanyuanImportSelection', 'DaguanyuanMathApi']) vm.runInContext(read('src/' + name + '.js'), run.context);
  run.controller.webView.evaluateJavaScript = (script, callback) => {
    try { const value = vm.runInContext(script, browser.context); receipts.push(value); callback(value, null); } catch (error) { callback(null, error); }
  };
  await run.context.openDaguanyuanQuestion(run.controller, detailOnly
    ? { url: 'https://cxyonly.fans/math/questions/2801', imported: true, questionId: 2801 }
    : { ...run.route, imported: true, questionId: 2801 });
  assert.equal(run.messages.length, 1);
  assert.equal(new URL(run.opened[0]).origin, 'https://math.cxyonly.fans');
  assert.equal(new URL(run.opened[0]).pathname, '/practice');
  const path = requests.find(path => path.includes('/position?')), query = new URL(path, browser.context.location).searchParams;
  assert.match(path, /question-lists\/complete\/position/);
  assert.equal(query.get('question_id'), '2801');
  assert.equal(query.get('category_id'), '704');
  assert.equal(query.get('per_page'), '30');
  assert.equal(query.get('revision'), '7');
  assert.equal(query.get('scope'), 'complete');
  assert.equal(requests.length, detailOnly ? 4 : 3);
  assert.doesNotMatch(JSON.stringify(receipts), /fixture-source-token/);
});

test('原题位置返回错误题目、错误修订、错误页码或不包含题目时停止', async () => {
  for (const change of [r => { r.available = false; }, r => { r.question_id = 2802; }, r => { r.definition_revision = 8; }, r => { r.page = 1; }]) {
    const reply = { available: true, question_id: 2801, definition_revision: 7, position: 38, page: 2 }; change(reply);
    const payload = JSON.stringify(reply), native = { __DAGUANYUAN_MATH_CATALOG_PAGE_SCRIPT__: 'fixture',
      __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__: { evaluate: async (controller, script) => script.includes('.read(')
        ? JSON.stringify({ status: 'ready', length: payload.length }) : script.includes('.chunk(') ? payload : 'accepted' },
      NSTimer: { scheduledTimerWithTimeInterval(seconds, repeat, callback) { callback(); } } };
    vm.createContext(native); vm.runInContext(read('src/DaguanyuanMathApi.js'), native);
    await assert.rejects(native.__DAGUANYUAN_MATH_API_GLOBAL__.questionListPosition({ listId: 'complete', listRevision: 7,
      categoryId: 704, scope: 'complete', examSubject: 'all' }, 2801, { webView: {} }), /原题|版本/);
  }
});

test('单题视图按本次解析的 ID 定位，范围被改动时不滚动另一题', () => {
  const run = runtime(), native = { JSB: { defineClass() {} } };
  vm.createContext(native); vm.runInContext(read('src/WebPanelController.js'), native);
  const route = { ...run.route, scope: 'complete', examSubject: 'math_1', listId: 'core-math-1', listRevision: 7,
    modern: true, page: 2, pageSize: 30, questionId: 338 };
  for (const wrongList of [false, true]) {
    const browser = page('https://cxyonly.fans/math/practice/' + (wrongList ? 'complete' : 'core-math-1') + '/all/704?listRevision=7&examSubject=math_1&page=2&questionId=338', '<li data-learning-question-id="338"></li>', { 'daguan:question-bank-scope': 'core' });
    let scrolled = false; browser.document.querySelector('li').scrollIntoView = () => { scrolled = true; };
    browser.context.setTimeout = () => {};
    vm.runInContext(native.__DAGUANYUAN_WEB_PANEL_GLOBAL__.questionLocatorScript(route), browser.context);
    assert.equal(scrolled, !wrongList);
  }
});

for (const status of [200, 401, 428]) test('真实网页桥串联题单元数据、目录与分页，HTTP ' + status, async () => {
  const browser = page('https://cxyonly.fans/math/practice/core-math-1/all/704?listRevision=7', '', {
    daguan_token: 'fixture-login-token', daguan_user: JSON.stringify({ id: 27, math_exam_subject: 'math_1' }),
  });
  const requests = [], receipts = [], run = runtime();
  Object.assign(browser.context, { setTimeout, clearTimeout, AbortController,
    fetch: async (path, options) => {
      requests.push({ path, method: options.method, auth: options.headers.Authorization });
      const address = new URL(path, browser.context.location);
      const data = address.pathname.endsWith('/directory') ? (() => { const d = directory(); delete d.definition_revision; return d; })()
        : address.pathname === '/api/questions' ? { code: 0, data: { total: 39,
          items: Array.from({ length: 19 }, (_, index) => ({ id: 321 + index, category_id: 704 })) } }
          : { code: 0, data: { id: 'core-math-1', revision: 7 } };
      return { status, ok: status === 200, json: async () => data };
    } });
  run.context.__DAGUANYUAN_MATH_CATALOG_PAGE_SCRIPT__ = read('web/src/DaguanyuanMathCatalogPage.js');
  run.context.NSTimer = { scheduledTimerWithTimeInterval(seconds, repeat, callback) { const timer = setTimeout(callback, Math.min(seconds * 1000, 1)); return { invalidate() { clearTimeout(timer); } }; } };
  for (const name of ['DaguanyuanWebsiteBridge', 'DaguanyuanImportSelection', 'DaguanyuanMathApi']) vm.runInContext(read('src/' + name + '.js'), run.context);
  run.controller.webView.evaluateJavaScript = (script, callback) => {
    try { const value = vm.runInContext(script, browser.context); receipts.push(value); callback(value, null); }
    catch (error) { callback(null, error); }
  };
  await run.context.openDaguanyuanQuestion(run.controller, run.route);
  assert.doesNotMatch(JSON.stringify(receipts), /fixture-login-token/);
  assert.ok(requests.every(r => r.method === 'GET'));
  if (status !== 200) {
    assert.equal(run.opened.length, 0);
    assert.match(run.messages[0], status === 401 ? /登录已过期/ : /访问验证/);
    assert.equal(requests.length, 1);
    return;
  }
  assert.equal(run.messages.length, 1);
  assert.equal(new URL(run.opened[0]).searchParams.get('questionId'), '338');
  assert.equal(requests.length, 3);
  assert.match(requests[0].path, /question-lists\/core-math-1\?revision=7$/);
  assert.match(requests[1].path, /directory\?exam_subject=math_1&scope=complete&revision=7$/);
  const query = new URL(requests[2].path, browser.context.location).searchParams;
  assert.equal(query.get('question_list_id'), 'core-math-1');
  assert.equal(query.get('question_list_revision'), '7');
  assert.equal(query.get('category_id'), '704');
  assert.equal(query.get('page'), '2');
  assert.equal(query.get('per_page'), '20');
});

test('分类快捷跳转复用题单校验，但不读取题目分页或注入题目定位', async () => {
  const run = runtime({ questions() { throw Error('分类跳转不应读取题目'); } });
  const source = read('src/WebPanelController.js'), start = source.indexOf('function openDaguanyuanCategory(');
  vm.runInContext(source.slice(start, source.indexOf('function open408Page(', start)), run.context);
  run.context.openDaguanyuanCategory(run.controller, run.route.url);
  await tick();
  assert.equal(new URL(run.opened[0]).searchParams.get('categoryId'), '704');
  assert.equal(new URL(run.opened[0]).searchParams.has('questionId'), false);
  assert.equal(run.controller.pendingQuestionLocator, undefined);
});

test('跨域链接、多个当前题单与损坏版本均不能伪装为有效选择', () => {
  const run = page('https://cxyonly.fans/math/practice', '<a aria-current="page" href="https://evil.example/math/lists/core">外站</a>');
  assert.equal(run.read().selection.listId, '');
  run.document.body.innerHTML = '<a aria-current="page" href="/math/lists/core">严选</a><a aria-current="page" href="/math/lists/complete">完整</a>';
  assert.equal(run.read().selection.listId, '');
  run.context.location = new URL('https://cxyonly.fans/math/practice?listId=core&listRevision=broken');
  assert.equal(run.read().selection.listRevision, -1);
});
