import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const read = name => fs.readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
// 依据网站公开的搜索预览组件保留结构，题干与来源使用测试内容。
const card = id => `<div data-question-preview-loaded><article data-learning-question-card data-question-surface>
  <header><div><strong>第 ${id} 题</strong><button data-question-source>测试来源</button><span>相关知识点</span></div></header>
  <article class="question-document" data-question-id="${id}">测试题干</article><footer><button data-site-note>笔记</button></footer>
</article></div>`;

function runtime(address = 'https://math.cxyonly.fans/') {
  const { document, Event } = parseHTML(`<html><head></head><body><main inert aria-hidden="true"><li data-learning-question-id="2345">背景中的同号题</li></main>
    <section role="dialog" aria-labelledby="search-title"><h2 id="search-title">搜索题目</h2><input type="search" value="2345"></section>
    <section role="dialog" aria-labelledby="preview-title"><h2 id="preview-title">题目 2345</h2>${card(2345)}</section></body></html>`);
  const timers = [], commands = [], observers = [];
  const setTimeout = fn => { const task = { fn, active: true }; timers.push(task); return task; };
  const append = document.body.appendChild.bind(document.body);
  document.body.appendChild = node => { if (node.tagName === 'IFRAME') commands.push(node.src); return append(node); };
  const window = { location: new URL(address), document, addEventListener() {}, setTimeout,
    clearTimeout(task) { if (task) task.active = false; }, getComputedStyle: node => node.style,
    getSelection: () => ({ removeAllRanges() {}, addRange() {} }) };
  document.createRange = () => ({ selectNodeContents() {}, collapse() {} });
  const context = vm.createContext({ window, location: window.location, document, URL, URLSearchParams, Event, console, setTimeout,
    MutationObserver: class { constructor(fn) { observers.push(fn); } observe() {} },
    File: class { constructor(parts, name, options) { this.type = options.type; this.name = name; } },
    atob: value => Buffer.from(value, 'base64').toString('binary') });
  vm.runInContext(read('DaguanyuanWebsiteBridge.js'), context);
  const bridge = context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  function flush() { for (let index = 0; timers.length && index < 100; index++) { const task = timers.shift(); if (task.active) task.fn(); } }
  function install() { vm.runInContext(bridge.practiceScript(true, true), context); vm.runInContext(bridge.singleImportScript(true), context); flush(); }
  function refresh() { observers.forEach(fn => fn()); flush(); }
  const dialog = document.querySelector('[aria-labelledby="preview-title"]');
  function switchQuestion(id, onlyTitle = false) {
    document.getElementById('preview-title').textContent = '题目 ' + id;
    if (!onlyTitle) dialog.querySelector('[data-question-preview-loaded]').outerHTML = card(id);
    refresh();
  }
  install();
  return { context, window, document, Event, bridge, dialog, commands, timers, install, flush, refresh, switchQuestion,
    buttons: () => Array.from(document.querySelectorAll('[data-daguanyuan-question-target]')),
    click(button) { button.dispatchEvent(new Event('click', { bubbles: true, cancelable: true })); },
    snapshot: () => window.__DAGUANYUAN_QUESTION_DOM__.read() };
}

for (const address of ['https://math.cxyonly.fans/', 'https://math.cxyonly.fans/lists/market',
  'https://math.cxyonly.fans/practice/core-math-2/all/45', 'https://www.cxyonly.fans/math']) {
  test('搜索预览显示三个工具，并以弹窗题号发送实际命令：' + address, () => {
    const run = runtime(address);
    assert.deepEqual(run.buttons().map(button => button.textContent), ['定位卡片', '添加笔记', '导入本题']);
    const source = run.dialog.querySelector('[data-question-source]');
    assert.equal(run.buttons()[0].previousElementSibling, source);
    for (const button of run.buttons()) run.click(button);
    assert.match(run.commands[0], /^daguanyuanbridge:\/\/locate-card\?id=2345$/);
    assert.match(run.commands[1], /^daguanyuanbridge:\/\/add-note\?id=2345$/);
    const native = vm.createContext({ __DAGUANYUAN_MATH_API_GLOBAL__: { positiveInteger: Number } });
    vm.runInContext(read('DaguanyuanSingleImport.js'), native);
    const target = native.__DAGUANYUAN_SINGLE_IMPORT_GLOBAL__.targetFromAddress(run.commands[2]);
    assert.equal(target.id, 2345);
    assert.equal(target.url, new URL(address).origin + (address.includes('math.cxyonly') ? '/questions/2345' : '/math/questions/2345'));
  });
}

test('切题加载过程中移除旧工具，新题加载后只操作新题，关闭后不保留入口', () => {
  const run = runtime();
  const old = run.buttons()[0];
  run.switchQuestion(8435, true); assert.equal(run.buttons().length, 0);
  run.click(old); assert.equal(run.commands.length, 0);
  run.switchQuestion(8435); assert.equal(run.buttons().length, 3);
  run.click(run.buttons()[0]); assert.match(run.commands[0], /id=8435$/);
  run.dialog.remove(); run.refresh(); assert.equal(run.buttons().length, 0);
});

test('搜索弹窗工具遵循独立开关，背景同号题不重复显示，未加载和隐藏弹窗不提供操作', () => {
  const run = runtime();
  assert.equal(run.snapshot().questions.length, 1);
  vm.runInContext(run.bridge.practiceScript(false, true), run.context); run.flush();
  assert.deepEqual(run.buttons().map(button => button.textContent), ['添加笔记', '导入本题']);
  vm.runInContext(run.bridge.singleImportScript(false), run.context); run.flush();
  assert.deepEqual(run.buttons().map(button => button.textContent), ['添加笔记']);
  run.dialog.hidden = true; run.refresh(); assert.equal(run.buttons().length, 0);
  run.dialog.hidden = false; run.dialog.querySelector('[data-question-preview-loaded]').remove();
  run.refresh(); assert.equal(run.buttons().length, 0);
});

test('只认可真实数学站的完整题目预览，不因为首页出现普通题卡就显示工具', () => {
  for (const address of ['https://example.test/', 'https://math.cxyonly.fans.evil.test/', 'http://math.cxyonly.fans/']) {
    assert.equal(runtime(address).buttons().length, 0);
  }
  const run = runtime(); run.dialog.removeAttribute('role'); run.refresh(); assert.equal(run.buttons().length, 0);
});

function nativePaste(run, { modal = false } = {}) {
  const native = vm.createContext({ __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__: run.bridge,
    UIPasteboard: { generalPasteboard: () => ({ image: { pngData: () => ({ length: 3, base64Encoding: () => 'AQID' }) } }) },
    NSTimer: { scheduledTimerWithTimeInterval() { return { invalidate() {} }; } } });
  vm.runInContext(read('DaguanyuanNotePaste.js'), native);
  const controller = { webView: { evaluateJavaScript(script, callback) {
    try { callback(vm.runInContext(script, run.context), null); } catch (error) { callback(null, error); }
  } } };
  let uploads = 0;
  run.dialog.querySelector('[data-site-note]').addEventListener('click', () => {
    const scope = modal ? run.document.createElement('section') : run.dialog.querySelector('[data-learning-question-card]');
    if (modal) { scope.setAttribute('role', 'dialog'); scope.setAttribute('data-kind', 'dialog'); scope.innerHTML = '<h2>题目笔记</h2>'; run.document.body.appendChild(scope); run.dialog.setAttribute('aria-hidden', 'true'); }
    scope.insertAdjacentHTML('beforeend', '<div data-note-save-feedback><span data-state="saved"></span></div><div data-note-rich-editor="true"><div data-note-editor="true" contenteditable="true"><p>原有笔记</p></div></div>');
    const wrapper = scope.querySelector('[data-note-rich-editor]'), editor = wrapper.querySelector('[data-note-editor]');
    editor.focus = () => {};
    wrapper.addEventListener('paste', event => { uploads++; editor.insertAdjacentHTML('beforeend', '<img data-attachment-id="new">'); });
  });
  return { api: native.__DAGUANYUAN_NOTE_PASTE_GLOBAL__, controller, uploads: () => uploads };
}

for (const modal of [false, true]) test('首页搜索预览通过真实原生入口向当前题目追加图片并确认保存，笔记弹窗=' + modal, async () => {
  const run = runtime(), paste = nativePaste(run, { modal });
  const token = await paste.api.start(paste.controller, 2345); run.flush();
  assert.equal(paste.uploads(), 1);
  assert.ok(run.dialog.textContent.includes('原有笔记') || run.document.querySelector('[data-kind="dialog"]').textContent.includes('原有笔记'));
  const result = run.commands.find(command => command.includes('add-note-result'));
  assert.match(result, /status=saved/);
  assert.match(paste.api.result(paste.controller, token, 'saved'), /图片已添加/);
});

for (const action of ['switch', 'close']) test('图片传输后、粘贴前搜索题目' + action + '会停止操作，避免写入背景同号题', async () => {
  const run = runtime(), paste = nativePaste(run);
  await paste.api.start(paste.controller, 2345);
  if (action === 'switch') run.switchQuestion(8435); else run.dialog.remove();
  run.flush();
  assert.equal(paste.uploads(), 0);
  assert.ok(run.commands.some(command => /status=question-changed/.test(command)));
});

test('首页没有有效预览或题号不匹配时，不传输剪贴板图片', async () => {
  for (const state of ['missing', 'wrong-id', 'hidden']) {
    const run = runtime(), paste = nativePaste(run);
    if (state === 'missing') run.dialog.remove(); else if (state === 'hidden') run.dialog.hidden = true;
    await assert.rejects(paste.api.start(paste.controller, state === 'wrong-id' ? 8435 : 2345));
    assert.equal(paste.uploads(), 0); assert.equal(paste.controller.notePasteOperation, null);
  }
});
