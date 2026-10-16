import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import build from '../scripts/build-web.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
function runtime(url = 'https://www.cxyonly.fans/math/practice/1') {
  const { document, Event, HTMLElement } = parseHTML('<html><head></head><body></body></html>');
  HTMLElement.prototype.scrollIntoView = function () {};
  const location = { href: url }, messages = [], copied = {};
  const browser = { document, location, URL, console, setTimeout() { return 1; }, clearTimeout() {},
    MutationObserver: class { observe() {} }, window: { innerHeight: 700, addEventListener() {} } };
  browser.window.document = document;
  vm.createContext(browser);
  const timers = [];
  class NSNull {}
  const native = { console, NSNull, __DAGUANYUAN_IMPORT_PAGE_SCRIPT__: build.pageScript(),
    UIPasteboard: { generalPasteboard() { return copied; } },
    NSTimer: { scheduledTimerWithTimeInterval(time, repeats, callback) { const timer = { callback, invalidate() {} }; timers.push(timer); return timer; } } };
  vm.createContext(native);
  for (const name of ['DaguanyuanSourceLink', 'DaguanyuanCardComments', 'DaguanyuanMathImport', 'DaguanyuanImportReport', 'DaguanyuanImportSelection', 'WebBridgeCommands']) {
    vm.runInContext(readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8'), native);
  }
  const controller = { webView: { evaluateJavaScript(script, callback) {
    try { callback(vm.runInContext(script, browser), new NSNull()); } catch (error) { callback(null, error); }
  } } };
  const ui = native.__DAGUANYUAN_IMPORT_SELECTION_GLOBAL__;
  const commands = native.__DAGUANYUAN_WEB_BRIDGE_COMMANDS_GLOBAL__;
  const bridgeContext = { controller, openCategory() {}, openSingle() {} };
  const append = document.body.appendChild.bind(document.body);
  document.body.appendChild = node => {
    const result = append(node);
    if (node.tagName === 'IFRAME') {
      messages.push(JSON.parse(decodeURIComponent(node.src.split('payload=')[1])));
      queueMicrotask(() => commands.handle(bridgeContext, node.src));
    }
    return result;
  };
  function click(selector) { const node = document.querySelector(selector); assert.ok(node, selector); node.dispatchEvent(new Event('click', { bubbles: true })); }
  function select(id, value) { const node = document.getElementById('dgy-check-' + id); node.checked = value; node.dispatchEvent(new Event('change', { bubbles: true })); }
  async function open(scope = 'selected', size = 4) {
    ui.begin(controller, '', scope);
    const confirm = ui.confirmation(controller);
    const pending = confirm({ source: '数学 / 极限', target: '考研学习集', questions: Array.from({ length: size }, (_, i) => ({ id: i + 1, title: '第' + (i + 1) + '题', summary: '<img src="bad" onerror="bad()">题干' })) });
    await tick();
    return { pending, confirm, token: controller.importTask.token };
  }
  return { browser, native, controller, document, location, messages, ui, commands, bridgeContext, timers, copied, click, select, open };
}

test('真实网页勾选通过 bridge 提交，默认全选、全选清空、所选题按原序传输', async () => {
  const run = runtime(); const { pending } = await run.open();
  assert.equal(run.document.querySelector('#dgy-toolbar').hidden, false);
  assert.equal(run.document.querySelector('#dgy-commit').disabled, false);
  assert.equal(run.document.querySelectorAll('.is-selected').length, 4);
  assert.equal(run.document.querySelectorAll('.dgy-row').length, 4);
  assert.equal(run.document.querySelectorAll('#dgy-dialog img').length, 0);
  run.click('[data-action="select-all"]');
  assert.equal(run.document.querySelectorAll('.is-selected').length, 4);
  run.click('[data-action="select-none"]');
  assert.equal(run.document.querySelector('#dgy-commit').disabled, true);
  run.select(4, true); run.select(2, true); run.click('[data-action="commit"]');
  assert.deepEqual(Array.from(await pending), [2, 4]);
  assert.equal(run.messages.at(-1).command, 'commitQuestionImport');
  assert.equal(run.messages.at(-1).payload.count, 2);
  assert.equal(run.controller.importTask.status, 'running');
  await run.ui.show(run.controller, { total: 2, createdCount: 2, failed: [] });
  assert.match(run.document.querySelector('#dgy-result').textContent, /新建 2/);
  assert.equal(run.document.querySelector('#dgy-commit').hidden, true);
  run.click('[data-action="copy"]'); await tick();
  assert.match(run.copied.string, /新建 2/);
});

test('底部内容切换随所选题传入原生确认，运行中锁定，非法内容不授权', async () => {
  const run = runtime(); const { pending, confirm, token } = await run.open();
  assert.ok(run.document.querySelector('.dgy-meta [data-action="select-all"]'));
  assert.ok(run.document.querySelector('footer [data-content="questionAnswer"]'));
  assert.equal(run.document.querySelector('#dgy-cancel'), null);
  await assert.rejects(async () => run.ui.commit(run.controller, { token, count: 4, content: 'bad' }), /内容选项/);
  assert.equal(run.controller.importTask.status, 'confirm');
  run.click('[data-content="questionAnswer"]');
  assert.equal(run.document.querySelector('[data-content="questionAnswer"]').getAttribute('aria-pressed'), 'true');
  run.click('[data-action="commit"]');
  assert.deepEqual(Array.from(await pending), [1, 2, 3, 4]);
  assert.equal(confirm.content, 'questionAnswer');
  assert.equal(run.messages.at(-1).payload.content, 'questionAnswer');
  assert.equal(run.document.querySelector('[data-content="question"]').disabled, true);
  run.click('.dgy-header [data-action="close"]'); await tick();
  assert.equal(run.controller.importTask.cancelled, true);
});

test('网页选题命令只接收 selected，不接管原单题与整类入口', () => {
  const run = runtime();
  for (const scope of ['single', 'all', 'bad']) assert.throws(() => run.commands.commands.openQuestionImport(run.bridgeContext, { scope }), /导入范围无效/);
});

test('整类默认全选，大列表分块提交，重复提交不再授权', async () => {
  const run = runtime(); const { pending, token } = await run.open('all', 501);
  assert.equal(run.document.querySelectorAll('.is-selected').length, 501);
  run.click('[data-action="commit"]');
  assert.equal((await pending).length, 501);
  assert.throws(() => run.ui.commit(run.controller, { token, count: 501 }), /重复导入/);
});

test('取消选题和切换网页都解除待确认任务，不会继续导入', async () => {
  for (const routeChange of [false, true]) {
    const run = runtime(); const { pending, confirm } = await run.open();
    if (routeChange) { run.location.href = 'https://www.cxyonly.fans/math/practice/2'; run.browser.window.__DAGUANYUAN_IMPORT_UI__.refresh(); }
    else run.click('[data-action="close"]');
    assert.equal(await pending, false);
    assert.equal(run.document.getElementById('dgy-dialog').hidden, true);
    assert.throws(confirm.check, /停止导入/);
  }
});

test('停止导入取消后续写入许可，保留并显示已完成计数', async () => {
  const run = runtime(); const { pending, confirm } = await run.open('all');
  run.click('[data-action="commit"]'); await pending;
  run.click('[data-action="close"]'); await tick();
  assert.throws(confirm.check, /停止导入/);
  assert.equal(run.document.getElementById('dgy-dialog').hidden, false);
  await run.ui.show(run.controller, { createdCount: 1, interrupted: '已停止导入', failed: [] });
  assert.match(run.document.getElementById('dgy-result').textContent, /新建 1/);
});

test('篡改 ID、重复 ID、短缺分块都不授权，错误后仍可取消', async () => {
  for (const ids of [[999], [1, 1], []]) {
    const run = runtime(); const { pending, token } = await run.open();
    run.browser.window.__DAGUANYUAN_IMPORT_UI__.selectionChunk = () => JSON.stringify(ids);
    await assert.rejects(run.ui.commit(run.controller, { token, count: ids.length || 1 }), /不属于|重复|不完整/);
    assert.equal(run.controller.importTask.status, 'confirm');
    run.ui.cancel(run.controller, { token, dismiss: true }); assert.equal(await pending, false);
  }
});

test('读取期间关闭后迟到的确认不会重新打开，原生回调超时明确失败', async () => {
  const run = runtime();
  run.ui.begin(run.controller, '', 'all'); await run.controller.importTask.ready;
  run.ui.close(run.controller);
  assert.equal(await run.ui.confirmation(run.controller)({ questions: [] }), false);
  assert.equal(run.document.getElementById('dgy-dialog').hidden, true);
  const stalled = run.ui.evaluate({ webView: { evaluateJavaScript() {} } }, 'test');
  run.timers.at(-1).callback(); await assert.rejects(stalled, /超时/);
});

test('右下角统一三个入口，题库页面保留入口，非题库网站隐藏', async () => {
  for (const [url, hidden] of [
    ['https://www.cxyonly.fans/math/practice/1', false],
    ['https://www.408os.cn/exercise?year=2026', false],
    ['https://www.408os.cn/exercise?knowledgeId=52', false],
    ['https://www.408os.cn/exercise?mode=collection&collectionId=4', false],
    ['https://www.cxyonly.fans/', false], ['https://example.com/', true],
  ]) {
    const run = runtime(url); await run.ui.inject(run.controller);
    assert.equal(run.document.querySelector('#dgy-toolbar').hidden, hidden);
    assert.equal(run.document.querySelectorAll('#dgy-toolbar-actions button').length, 3);
    assert.equal(run.document.querySelector('#dgy-toolbar-actions').hidden, true);
    assert.equal(run.document.querySelector('[data-toggle-import-tools]').getAttribute('aria-expanded'), 'false');
    assert.equal(run.document.querySelector('[data-scope="selected"]').textContent, '选题导入');
    assert.equal(run.document.querySelector('[data-scope="single"]'), null);
    assert.equal(run.document.querySelector('[data-scope="all"]'), null);
  }
});

test('导入工具默认收起，重复点击展开收起，刷新和重复注入保留当前展开状态', async () => {
  const run = runtime(); await run.ui.inject(run.controller);
  const actions = run.document.querySelector('#dgy-toolbar-actions');
  const toggle = run.document.querySelector('[data-toggle-import-tools]');
  assert.equal(toggle.textContent, '');
  assert.equal(toggle.getAttribute('aria-label'), '导入工具');
  assert.equal(toggle.querySelectorAll('svg[aria-hidden="true"]').length, 1);
  assert.equal(actions.querySelectorAll('button svg[aria-hidden="true"]').length, 3);
  assert.equal(actions.hidden, true);
  run.click('[data-toggle-import-tools]');
  assert.equal(actions.hidden, false); assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(run.document.querySelector('#dgy-toolbar').getAttribute('data-expanded'), 'true');
  run.browser.window.__DAGUANYUAN_IMPORT_UI__.refresh(); await run.ui.inject(run.controller);
  assert.equal(actions.hidden, false); assert.equal(run.document.querySelectorAll('#dgy-toolbar').length, 1);
  run.click('[data-toggle-import-tools]');
  assert.equal(actions.hidden, true); assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(run.document.querySelector('#dgy-toolbar').getAttribute('data-expanded'), 'false');
});

test('显示选题导入开关实时隐藏与恢复入口，全部关闭仍可展开网页导航', async () => {
  const run = runtime();
  run.document.body.innerHTML = '<article class="question-document" data-question-id="11">题干</article>';
  const config = { bindEnabled: true, importEnabled: true, selectionEnabled: false };
  run.browser.window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__ = config;
  await run.ui.inject(run.controller); run.click('[data-toggle-import-tools]');
  const select = run.document.querySelector('[data-scope="selected"]');
  assert.equal(select.hidden, true);
  run.click('[data-scope="selected"]'); await tick(); assert.equal(run.messages.length, 0);
  assert.equal(run.document.querySelector('[data-import-current]').hidden, false);
  config.selectionEnabled = true; run.browser.window.__DAGUANYUAN_IMPORT_UI__.refresh();
  assert.equal(select.hidden, false); assert.equal(select.disabled, false);
  config.bindEnabled = config.importEnabled = config.selectionEnabled = false;
  run.browser.window.__DAGUANYUAN_IMPORT_UI__.refresh();
  assert.equal(run.document.querySelector('#dgy-toolbar').hidden, false);
  assert.equal(run.document.querySelector('[data-toggle-import-tools]').disabled, false);
  config.selectionEnabled = true; run.browser.window.__DAGUANYUAN_IMPORT_UI__.refresh();
  assert.equal(run.document.querySelector('#dgy-toolbar').hidden, false);
  assert.equal(run.document.querySelector('#dgy-toolbar-actions').hidden, false);
});

test('收起只显示省略号，展开底栏三格，无历史时返回置灰，导航调用当前 WebView', async () => {
  const run = runtime(), view = run.controller.webView, calls = [];
  view.canGoBack = false;
  view.goBack = () => { calls.push('back'); view.canGoBack = false; };
  view.reload = () => calls.push('reload');
  await run.ui.inject(run.controller);
  const back = run.document.querySelector('[data-navigate="back"]');
  const reload = run.document.querySelector('[data-navigate="reload"]');
  assert.equal(run.document.querySelectorAll('#dgy-toolbar-navigation button').length, 3);
  assert.equal(back.hidden, true); assert.equal(reload.hidden, true);
  run.click('[data-toggle-import-tools]');
  assert.equal(back.hidden, false); assert.equal(reload.hidden, false);
  assert.equal(back.disabled, true); assert.equal(reload.disabled, false);
  run.click('[data-navigate="back"]'); await tick(); assert.deepEqual(calls, []);
  run.click('[data-navigate="reload"]'); await tick(); assert.deepEqual(calls, ['reload']);
  view.canGoBack = true; await run.ui.inject(run.controller);
  run.click('[data-toggle-import-tools]'); run.click('[data-toggle-import-tools]');
  assert.equal(run.document.querySelector('#dgy-toolbar-navigation').hidden, false);
  assert.equal(back.disabled, false);
  run.click('[data-navigate="back"]'); await tick();
  assert.deepEqual(calls, ['reload', 'back']); assert.equal(back.disabled, true);
  run.click('[data-toggle-import-tools]');
  assert.equal(back.hidden, true); assert.equal(reload.hidden, true);
});

test('网页导航不允许打断导入，确认和执行期间均锁定，结束后恢复', async () => {
  const run = runtime(), view = run.controller.webView;
  let reloads = 0; view.reload = () => reloads++;
  const { pending } = await run.open();
  run.click('[data-toggle-import-tools]');
  run.browser.window.__DAGUANYUAN_IMPORT_UI__.refresh();
  assert.equal(run.document.querySelector('[data-navigate="reload"]').disabled, true);
  run.click('[data-navigate="reload"]'); await tick(); assert.equal(reloads, 0);
  run.click('[data-action="commit"]'); await pending;
  const navigate = () => run.commands.commands.navigateWebsite(run.bridgeContext, { action: 'reload' });
  assert.throws(navigate, /当前任务/);
  await run.ui.show(run.controller, { total: 4, createdCount: 4, failed: [] });
  run.browser.window.__DAGUANYUAN_IMPORT_UI__.refresh();
  assert.equal(run.document.querySelector('[data-navigate="reload"]').disabled, false);
  run.click('[data-navigate="reload"]'); await tick(); assert.equal(reloads, 1);
  for (const key of ['categoryImportBusy', 'singleImportBusy', 'questionToolBusy']) {
    run.controller[key] = true; assert.throws(navigate, /当前任务/); run.controller[key] = false;
  }
  run.controller.importWorkspaceTask = { status: 'running' }; assert.throws(navigate, /当前任务/);
  assert.throws(() => run.commands.commands.navigateWebsite({ ...run.bridgeContext, isImportWorkspace: true }, { action: 'reload' }), /题库网页/);
  assert.throws(() => run.commands.commands.navigateWebsite(run.bridgeContext, { action: 'bad' }), /操作无效/);
});

test('选题导入失败可以关闭提示，不留下无法关闭的假任务', async () => {
  const run = runtime(); run.document.body.innerHTML = '<article class="question-document" data-question-id="11">题干</article>'; await run.ui.inject(run.controller);
  run.bridgeContext.openCategory = () => { throw Error('无法读取当前分类'); };
  run.click('[data-scope="selected"]'); await tick();
  assert.match(run.document.getElementById('dgy-result').textContent, /无法读取当前分类/);
  run.click('[data-action="close"]'); await tick();
  assert.equal(run.document.getElementById('dgy-dialog').hidden, true);
});

test('选题导入入口向原生发送勾选范围', async () => {
  const run = runtime(); run.document.body.innerHTML = '<article class="question-document" data-question-id="11">题干</article>'; await run.ui.inject(run.controller);
  const calls = [];
  run.bridgeContext.openCategory = scope => calls.push(scope);
  run.bridgeContext.openSingle = target => calls.push(target);
  run.click('[data-scope="selected"]'); await tick();
  assert.deepEqual(calls, ['selected']);
});

test('导入题目在选题上方直接调用整类导入，运行中防止重复提交，完成后恢复', async () => {
  for (const url of ['https://www.cxyonly.fans/math/practice/categories/345', 'https://www.408os.cn/exercise?year=2026']) {
    const run = runtime(url);
    run.document.body.innerHTML = url.includes('408os')
      ? '<div class="question-card"><span class="year-tag">2026年</span><span class="index-tag">第1题</span>题干</div>'
      : '<article class="question-document" data-question-id="11">题干</article>';
    const config = { bindEnabled: true, importEnabled: true, importBusy: false };
    run.browser.window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__ = config;
    await run.ui.inject(run.controller);
    const direct = run.document.querySelector('[data-import-current]');
    assert.equal(direct.nextElementSibling.textContent, '选题导入');
    assert.equal(direct.disabled, false);
    const scopes = []; run.bridgeContext.openCategory = scope => scopes.push(scope);
    run.click('[data-import-current]'); run.click('[data-import-current]'); await tick();
    assert.deepEqual(scopes, ['all']);
    assert.equal(run.messages.at(-1).command, 'importCurrentQuestions');
    assert.equal(run.document.getElementById('dgy-dialog').hidden, true);
    assert.equal(direct.disabled, true); assert.equal(direct.textContent, '导入中…');
    assert.ok(direct.querySelector('svg'));
    config.importBusy = false; run.browser.window.__DAGUANYUAN_IMPORT_UI__.finishDirectImport();
    assert.equal(direct.disabled, false); assert.equal(direct.textContent, '导入题目');
    config.importEnabled = false; run.browser.window.__DAGUANYUAN_IMPORT_UI__.refresh();
    assert.equal(direct.hidden, true);
  }
});

test('直接导入拒绝时恢复按钮，空页面与题本页面不触发旧分类流程', async () => {
  const run = runtime(); await run.ui.inject(run.controller);
  const direct = run.document.querySelector('[data-import-current]');
  assert.equal(direct.disabled, true);
  run.document.body.insertAdjacentHTML('afterbegin', '<article class="question-document" data-question-id="11">题干</article>');
  run.browser.window.__DAGUANYUAN_IMPORT_UI__.refresh();
  run.bridgeContext.openCategory = () => { throw Error('读取失败'); };
  run.click('[data-import-current]'); await tick();
  assert.equal(direct.disabled, false); assert.equal(direct.textContent, '导入题目');
  run.location.href = 'https://www.cxyonly.fans/math/papers/1';
  run.browser.window.__DAGUANYUAN_IMPORT_UI__.refresh();
  assert.equal(direct.disabled, true);
  assert.equal(run.document.querySelector('[data-scope="selected"]').disabled, false);
  assert.throws(() => run.commands.commands.importCurrentQuestions({ ...run.bridgeContext, isImportWorkspace: true }), /题库网页/);
  run.controller.singleImportBusy = true;
  assert.throws(() => run.commands.commands.importCurrentQuestions(run.bridgeContext), /尚未结束/);
});

test('网页刚切换但观察器尚未运行时，提交仍拒绝旧选择', async () => {
  const run = runtime(); const { pending } = await run.open('all');
  run.location.href = 'https://www.cxyonly.fans/math/practice/2';
  run.click('[data-action="commit"]'); await tick();
  assert.equal(run.controller.importTask.status, 'confirm');
  assert.match(run.document.getElementById('dgy-status').textContent, /选择已失效/);
  run.ui.close(run.controller); assert.equal(await pending, false);
});


test('绑定分类排在选题导入之前，两者同步禁用，点击沿用原生绑定入口', async () => {
  const run = runtime(); await run.ui.inject(run.controller);
  const toolbar = run.document.querySelector('#dgy-toolbar');
  const bind = toolbar.querySelector('[data-bind-category]'), select = toolbar.querySelector('[data-scope="selected"]');
  assert.equal(bind.textContent, '绑定分类'); assert.equal(bind.nextElementSibling.textContent, '导入题目'); assert.equal(bind.nextElementSibling.nextElementSibling, select);
  assert.equal(bind.disabled, true); assert.equal(select.disabled, true);
  run.click('[data-bind-category]'); await tick(); assert.equal(run.messages.length, 0);
  run.document.body.insertAdjacentHTML('afterbegin', '<article class="question-document" data-question-id="31">题干</article>');
  run.browser.window.__DAGUANYUAN_IMPORT_UI__.refresh();
  assert.equal(bind.disabled, false); assert.equal(select.disabled, false);
  let bindings = 0; run.bridgeContext.bindCategory = () => { bindings++; };
  run.click('[data-bind-category]'); await tick();
  assert.equal(bindings, 1); assert.equal(run.messages.at(-1).command, 'bindCurrentCategory');
  assert.equal(run.document.getElementById('dgy-dialog').hidden, true);
  run.browser.window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__ = { bindEnabled: false };
  run.browser.window.__DAGUANYUAN_IMPORT_UI__.refresh(); assert.equal(bind.hidden, true); assert.equal(select.hidden, false);
  run.browser.window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__.bindEnabled = true;
  run.browser.window.__DAGUANYUAN_IMPORT_UI__.refresh(); assert.equal(bind.hidden, false);
});
test('绑定 bridge 拒绝独立导入页和运行中的题目任务', () => {
  const run = runtime(); let bindings = 0; run.bridgeContext.bindCategory = () => { bindings++; };
  assert.throws(() => run.commands.commands.bindCurrentCategory({ ...run.bridgeContext, isImportWorkspace: true }), /题库网页/);
  for (const flag of ['categoryImportBusy', 'singleImportBusy', 'questionToolBusy']) {
    run.controller[flag] = true; assert.throws(() => run.commands.commands.bindCurrentCategory(run.bridgeContext), /尚未结束/); run.controller[flag] = false;
  }
  assert.equal(bindings, 0);
});
