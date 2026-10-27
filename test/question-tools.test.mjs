import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const target = { provider: '408', year: 2026, number: 44, url: 'https://www.408os.cn/exercise?year=2026' };
const tick = () => new Promise(resolve => setImmediate(resolve));
function runtime(options = {}) {
  let methods, resolve, reject, locateResolve, locateReject;
  const calls = [], messages = [], scripts = [], timers = [];
  const stored = new Map([['cn.marginnote.daguanyuan-bridge.panel-visible', true]]);
  const study = { view: { bounds: { x: 0, y: 0, width: 1024, height: 768 },
    addSubview(view) { view.superview = this; calls.push(['show']); } },
    refreshAddonCommands() { calls.push(['refresh']); } };
  const context = {
    console, JSB: { defineClass(name, instanceMethods) { methods = instanceMethods; return {}; } },
    NSUserDefaults: { standardUserDefaults() { return { objectForKey(key) {
      if (key.endsWith('add-note-visible')) return options.note !== false;
      if (key.endsWith('website-locate-card-visible')) return options.locate !== false;
      return stored.get(key) ?? false;
    }, setObjectForKey(value, key) { stored.set(key, value); } }; } },
    Application: { sharedInstance() { return { showHUD(message) { messages.push(message); }, studyController() { return study; } }; } },
    NSTimer: { scheduledTimerWithTimeInterval(interval, repeats, callback) { timers.push(callback); } },
    __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__: { cancelMode() {} },
    __DAGUANYUAN_VIDEO_BROWSER_GLOBAL__: { handles() { return false; } },
    __DAGUANYUAN_MATH_API_GLOBAL__: { positiveInteger(v) { assert.ok(Number(v) > 0); return Number(v); } },
    __DAGUANYUAN_408_IMPORT_GLOBAL__: { resolveQuestion(controller, t) {
      calls.push(['lookup', JSON.parse(JSON.stringify(t))]); return new Promise((yes, no) => { resolve = yes; reject = no; });
    } },
    __DAGUANYUAN_MATH_IMPORT_GLOBAL__: { focusQuestion(addon, id, provider) {
      calls.push(['locate', id, provider]);
      if (options.deferLocate) return new Promise((yes, no) => { locateResolve = yes; locateReject = no; });
    } },
    __DAGUANYUAN_408_NOTE_PASTE_GLOBAL__: { start(controller, question) {
      calls.push(['note', JSON.parse(JSON.stringify(question))]);
      if (options.noImage) return Promise.reject(Error('剪贴板中没有图片'));
      controller.notePasteOperation = { token: '123-456' }; return Promise.resolve('123-456');
    } },
    __DAGUANYUAN_NOTE_PASTE_GLOBAL__: { start(controller, id) {
      calls.push(['note', id]);
      controller.notePasteOperation = { token: '123-456' }; return Promise.resolve('123-456');
    } },
  };
  vm.createContext(context);
  for (const name of ['DaguanyuanSingleImport', 'WebPanelController']) vm.runInContext(fs.readFileSync(new URL(`../src/${name}.js`, import.meta.url), 'utf8'), context);
  const panel = { currentContentPage: '408', activePage: '408', panelVisible: true, addon: { window: {} },
    view: { hidden: false, superview: study.view, removeFromSuperview() { this.superview = null; calls.push(['hide']); } },
    settingsPage: {}, categoryManagerPage: {},
    webView: { URL: 'https://www.408os.cn/exercise?year=2026', evaluateJavaScript(script, cb) { scripts.push(script); cb(true, null); },
      loadRequest() { throw Error('恢复面板不应重新加载网页'); } } };
  context.self = panel;
  return { panel, calls, messages, scripts, stored, timers, api: context.__DAGUANYUAN_WEB_PANEL_GLOBAL__,
    send(command) { return methods.webViewShouldStartLoadWithRequestNavigationType(panel.webView, { URL: { absoluteString: 'daguanyuanbridge://' + command + '?payload=' + encodeURIComponent(JSON.stringify(target)) } }); },
    complete() { resolve({ ...target, id: 843 }); }, fail() { reject(Error('题目读取失败')); },
    sendMath(command = 'locate-card') { return methods.webViewShouldStartLoadWithRequestNavigationType(panel.webView, { URL: { absoluteString: 'daguanyuanbridge://' + command + '?id=3356' } }); },
    completeLocate(error) { if (error) locateReject(Error(error)); else locateResolve({ noteId: 'target' }); },
  };
}

test('408 原生工具解析题号后定位专属题卡，查询期间阻止重复读取', async () => {
  const run = runtime(); assert.equal(run.send('locate-card'), false);
  assert.equal(run.panel.questionToolBusy, true); assert.deepEqual(run.calls[0], ['lookup', target]);
  run.send('add-note'); assert.equal(run.calls.length, 1);
  run.complete(); await tick();
  assert.equal(run.panel.questionToolBusy, false);
  assert.deepEqual(run.calls[1], ['locate', 843, '408']);
  assert.match(run.scripts.at(-1), /finishLocate/); assert.equal(run.messages.at(-1), '已定位脑图卡片');
});

test('数学和 408 定位成功后才收起面板，重新打开保留原网页及标签页', async () => {
  for (const provider of ['math', '408']) {
    const run = runtime({ deferLocate: true });
    run.panel.currentContentPage = run.panel.activePage = provider;
    const webView = run.panel.webView, originalURL = webView.URL;
    if (provider === '408') { run.send('locate-card'); run.complete(); } else run.sendMath();
    await tick();
    assert.equal(run.panel.panelVisible, true);
    assert.equal(run.panel.view.hidden, false);
    assert.equal(run.calls.some(c => c[0] === 'hide'), false);
    run.completeLocate(); await tick();
    assert.equal(run.panel.panelVisible, false);
    assert.equal(run.panel.view.hidden, true);
    assert.equal(run.panel.view.superview, null);
    assert.equal(run.stored.get('cn.marginnote.daguanyuan-bridge.panel-visible'), false);
    assert.equal(run.calls.filter(c => c[0] === 'hide').length, 1);
    assert.equal(run.timers.length, 1); run.timers[0]();
    assert.equal(run.calls.filter(c => c[0] === 'refresh').length, 1);
    run.api.showPanel(run.panel);
    assert.equal(run.panel.panelVisible, true);
    assert.equal(run.panel.view.hidden, false);
    assert.ok(run.panel.view.superview);
    assert.equal(run.panel.webView, webView);
    assert.equal(run.panel.webView.URL, originalURL);
    assert.equal(run.panel.activePage, provider);
    assert.equal(run.stored.get('cn.marginnote.daguanyuan-bridge.panel-visible'), true);
  }
});

test('未找到题卡、取消或超时时不收起面板，清理锁后可以重试', async () => {
  for (const provider of ['math', '408']) {
    for (const reason of ['没有这道题的脑图卡片', '已取消定位', '切换目标学习集超时']) {
      const run = runtime({ deferLocate: true });
      if (provider === '408') { run.send('locate-card'); run.complete(); } else run.sendMath();
      await tick(); run.completeLocate(reason); await tick();
      assert.equal(run.panel.panelVisible, true);
      assert.equal(run.panel.view.hidden, false);
      assert.ok(run.panel.view.superview);
      assert.equal(run.stored.get('cn.marginnote.daguanyuan-bridge.panel-visible'), true);
      assert.equal(run.timers.length, 0);
      assert.equal(run.calls.some(c => c[0] === 'hide'), false);
      assert.equal(run.messages.at(-1), reason);
      if (provider === '408') { run.send('locate-card'); run.complete(); } else run.sendMath();
      await tick(); run.completeLocate(); await tick();
      assert.equal(run.panel.panelVisible, false);
    }
  }
});

test('408 读取失败、导入锁及添加笔记不收起面板', async () => {
  const lookup = runtime(); lookup.send('locate-card'); lookup.fail(); await tick();
  assert.equal(lookup.panel.panelVisible, true); assert.equal(lookup.panel.view.hidden, false);
  for (const provider of ['math', '408']) {
    for (const lock of ['categoryImportBusy', 'singleImportBusy', 'questionToolBusy']) {
      const run = runtime(); run.panel[lock] = true;
      if (provider === '408') run.send('locate-card'); else run.sendMath();
      await tick();
      assert.equal(run.panel.panelVisible, true); assert.equal(run.panel.view.hidden, false);
      assert.equal(run.calls.some(c => c[0] === 'hide'), false);
    }
  }
  const note = runtime(); note.send('add-note'); await tick();
  note.complete(); await tick();
  assert.deepEqual(note.calls.map(call => call[0]), ['lookup', 'note']);
  assert.equal(note.messages.at(-1), '正在添加图片，等待 408 网站保存');
  assert.equal(note.panel.panelVisible, true); assert.equal(note.panel.view.hidden, false);
});

test('关闭添加笔记时阻止数学或 408 操作，定位卡片仍受独立开关控制', async () => {
  for (const provider of ['math', '408']) {
    const run = runtime({ note: false });
    if (provider === 'math') {
      run.panel.currentContentPage = run.panel.activePage = 'math';
      run.sendMath('add-note');
    } else run.send('add-note');
    await tick();
    assert.equal(run.calls.length, 0);
    assert.equal(run.panel.questionToolBusy, undefined);
    assert.equal(run.messages.at(-1), '添加笔记暂不可用');
    assert.match(run.scripts.at(-1), /finishNotePaste/);
    assert.equal(run.panel.panelVisible, true);
  }
  const off = runtime({ locate: false }); off.send('locate-card');
  assert.equal(off.calls.length, 0); assert.match(off.messages.at(-1), /开关/);
});

test('开启添加笔记时数学和 408 均可添加图片，关闭定位开关不影响添加', async () => {
  for (const provider of ['math', '408']) {
    const run = runtime({ note: true, locate: false });
    if (provider === 'math') {
      run.panel.currentContentPage = run.panel.activePage = 'math';
      run.sendMath('add-note');
    } else {
      run.send('add-note'); run.complete();
    }
    await tick();
    assert.equal(run.calls.filter(call => call[0] === 'note').length, 1);
    assert.equal(run.panel.notePasteOperation.token, '123-456');
    assert.equal(run.panel.panelVisible, true);
  }
});

test('408 定位卡片读取失败时恢复按钮并返回原因', async () => {
  const lookup = runtime(); lookup.send('locate-card'); lookup.fail(); await tick();
  assert.equal(lookup.panel.questionToolBusy, false); assert.match(lookup.scripts.at(-1), /finishLocate/);
  assert.equal(lookup.messages.at(-1), '题目读取失败');
});

test('数学、复测和 408 按钮等待异步定位结束，不提前提示成功或恢复按钮', async () => {
  for (const provider of ['math', '408']) {
    const run = runtime({ deferLocate: true });
    if (provider === '408') { run.send('locate-card'); run.complete(); }
    else run.sendMath();
    await tick();
    assert.equal(run.panel.questionToolBusy, true);
    assert.equal(run.messages.includes('已定位脑图卡片'), false);
    assert.equal(run.scripts.some(s => s.includes('finishLocate')), false);
    if (provider === '408') run.send('locate-card'); else run.sendMath();
    assert.equal(run.calls.filter(c => c[0] === 'locate').length, 1);
    assert.equal(run.scripts.some(s => s.includes('finishLocate')), false);
    run.completeLocate(); await tick();
    assert.equal(run.panel.questionToolBusy, false); assert.equal(run.panel.cardLocationActive, false);
    assert.equal(run.messages.at(-1), '已定位脑图卡片'); assert.match(run.scripts.at(-1), /finishLocate/);
  }
});

test('异步定位超时或取消时，数学和 408 均清理锁并恢复按钮', async () => {
  for (const provider of ['math', '408']) {
    const run = runtime({ deferLocate: true });
    if (provider === '408') { run.send('locate-card'); run.complete(); } else run.sendMath();
    await tick(); run.completeLocate('切换目标学习集超时，请稍后重试'); await tick();
    assert.equal(run.panel.questionToolBusy, false); assert.equal(run.panel.cardLocationActive, false);
    assert.match(run.messages.at(-1), /切换目标学习集超时/); assert.match(run.scripts.at(-1), /finishLocate/);
    assert.equal(run.messages.includes('已定位脑图卡片'), false);
  }
});
