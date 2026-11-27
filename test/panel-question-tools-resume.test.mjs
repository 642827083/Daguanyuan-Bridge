import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { withMathSite } from './helpers/math-site.mjs';

const tick = () => new Promise(resolve => setImmediate(resolve));
const read = name => withMathSite(fs.readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8'));
function runtime(provider, options = {}) {
  let methods, panel;
  const observers = [], timers = [], opened = [], commands = [], errors = [];
  const math = provider === 'math', address = math ? 'https://math.cxyonly.fans/practice/8' : 'https://www.408os.cn/exercise?year=2026';
  const { document, Event } = parseHTML('<html><body>' + (math
    ? '<li data-learning-question-id="42"><article data-learning-question-card><header><div><strong>1</strong><span data-question-source>来源</span></div></header><article class="question-document" data-question-id="42">题干</article></article></li>'
    : '<div class="question-card"><div class="question-header"><div class="header-tags"><span class="year-tag">2026</span><span class="index-tag">第44题</span><span class="score-tag">10分</span></div></div></div>') + '</body></html>');
  const window = { location: new URL(address), document, addEventListener() {}, removeEventListener() {},
    setTimeout(fn, delay) { const task = { fn, delay, active: true }; timers.push(task); return task; },
    clearTimeout(task) { if (task && typeof task === 'object') task.active = false; },
    // 模拟面板离开原生窗口期间题目暂时不可见；恢复面板本身不产生网页 DOM 变更。
    getComputedStyle(node) { return panel && panel.view.hidden ? { display: 'none' } : node.style; } };
  const browser = vm.createContext({ window, document, location: window.location, URL, URLSearchParams,
    MutationObserver: class { constructor(fn) { observers.push(fn); } observe() {} disconnect() {} } });
  const append = document.body.appendChild.bind(document.body);
  document.body.appendChild = node => { if (node.tagName === 'IFRAME') commands.push(node.src); return append(node); };
  const study = { view: { bounds: { x: 0, y: 0, width: 1024, height: 768 }, addSubview(view) { view.superview = this; } }, refreshAddonCommands() {} };
  const native = vm.createContext({ console: { log: message => errors.push(message) },
    JSB: { defineClass(name, instance) { methods = instance; return {}; } },
    NSUserDefaults: { standardUserDefaults() { return { objectForKey(key) {
      if (key.endsWith('website-locate-card-visible')) return options.locate !== false;
      if (key.endsWith('add-note-visible')) return options.note !== false;
      if (key.endsWith('import-single-visible')) return options.single !== false;
      return true;
    }, setObjectForKey() {} }; } },
    Application: { sharedInstance() { return { showHUD() {}, studyController() { return study; } }; } },
    NSTimer: { scheduledTimerWithTimeInterval() {} },
    __DAGUANYUAN_VIDEO_BROWSER_GLOBAL__: { handles() { return false; } },
    __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__: { cancelMode() {} },
    __DAGUANYUAN_MATH_API_GLOBAL__: { positiveInteger: Number },
    __DAGUANYUAN_MATH_IMPORT_GLOBAL__: { focusQuestion() { return Promise.resolve(); } },
    __DAGUANYUAN_408_IMPORT_GLOBAL__: { resolveQuestion() { return Promise.resolve({ id: 843, year: 2026, number: 44 }); } },
  });
  for (const name of ['DaguanyuanCategoryRoutes', 'DaguanyuanWebsiteBridge', 'DaguanyuanRetestBridge', 'DaguanyuanSingleImport', 'WebPanelController']) vm.runInContext(read(name), native);
  panel = { currentContentPage: provider, activePage: provider, panelVisible: true, addon: { window: {} }, settingsPage: {}, categoryManagerPage: {},
    view: { hidden: false, superview: study.view, removeFromSuperview() { this.superview = null; } },
    webView: { URL: address, evaluateJavaScript(script, cb) { try { cb(vm.runInContext(script, browser), null); } catch (error) { errors.push(error.message); cb(null, error); } },
      loadRequest(url) { opened.push(url); } } };
  native.self = panel;
  const bridge = native.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__, api = native.__DAGUANYUAN_WEB_PANEL_GLOBAL__;
  const flush = () => { for (let i = 0; timers.length && i < 50; i++) { const task = timers.shift(); if (task.active) task.fn(); } };
  vm.runInContext(bridge.practiceScript(true, true) + bridge.singleImportScript(true), browser); flush();
  return { panel, document, Event, window, commands, errors, opened, api, flush,
    send() { const url = math ? 'daguanyuanbridge://locate-card?id=42' : 'daguanyuanbridge://locate-card?payload=' + encodeURIComponent(JSON.stringify({ provider, year: 2026, number: 44, url: address }));
      methods.webViewShouldStartLoadWithRequestNavigationType(panel.webView, { URL: { absoluteString: url } }); },
    mutate(record) { observers.forEach(fn => fn([record])); flush(); } };
}

for (const provider of ['math', '408']) test(provider + ' 定位卡片后重新打开原面板，恢复三个按钮且可再次定位', async () => {
  const run = runtime(provider), buttons = () => Array.from(run.document.querySelectorAll('[data-daguanyuan-question-target]'));
  assert.equal(buttons().length, 3);
  run.send(); await tick(); assert.equal(run.panel.view.hidden, true);
  run.flush(); assert.equal(buttons().length, 0);
  const view = run.panel.webView;
  run.api.showPanel(run.panel); run.flush();
  assert.equal(run.panel.webView, view); assert.equal(run.opened.length, 0);
  assert.deepEqual(buttons().map(b => b.textContent), ['定位卡片', '添加笔记', '导入本题']);
  buttons()[0].dispatchEvent(new run.Event('click', { bubbles: true, cancelable: true }));
  assert.match(run.commands.at(-1), /locate-card/);
  assert.deepEqual(run.errors, []);
});

test('网站重绘只移除了插件按钮时仍恢复三个入口，不依赖题干或分类变化', () => {
  const run = runtime('math'), removed = Array.from(run.document.querySelectorAll('[data-daguanyuan-question-target]'));
  const target = removed[0].parentElement;
  removed.forEach(button => button.remove());
  run.mutate({ type: 'childList', target, addedNodes: [], removedNodes: removed });
  assert.equal(run.document.querySelectorAll('[data-daguanyuan-question-target]').length, 3);
});

test('重新打开时沿用三个独立开关，不强制显示已关闭的按钮，反复恢复不重复插入', () => {
  for (const [key, hidden] of [['locate', '定位卡片'], ['note', '添加笔记'], ['single', '导入本题']]) {
    const run = runtime('math', { [key]: false });
    for (let i = 0; i < 5; i++) { run.api.showPanel(run.panel); run.flush(); }
    const buttons = Array.from(run.document.querySelectorAll('[data-daguanyuan-question-target]'));
    assert.equal(buttons.length, 2);
    assert.ok(buttons.every(button => button.textContent !== hidden && !button.disabled));
    assert.deepEqual(run.errors, []);
    assert.equal(run.opened.length, 0);
  }
});
