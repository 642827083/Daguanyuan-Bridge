import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const target = { provider: '408', year: 2026, number: 44, url: 'https://www.408os.cn/exercise?year=2026' };
const tick = () => new Promise(resolve => setImmediate(resolve));
function runtime(options = {}) {
  let methods, resolve, reject, locateResolve, locateReject;
  const calls = [], messages = [], scripts = [];
  const context = {
    console, JSB: { defineClass(name, instanceMethods) { methods = instanceMethods; return {}; } },
    NSUserDefaults: { standardUserDefaults() { return { objectForKey(key) {
      if (key.endsWith('add-note-visible')) return options.note !== false;
      if (key.endsWith('website-locate-card-visible')) return options.locate !== false;
      return false;
    } }; } },
    Application: { sharedInstance() { return { showHUD(message) { messages.push(message); } }; } },
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
  };
  vm.createContext(context);
  for (const name of ['DaguanyuanSingleImport', 'WebPanelController']) vm.runInContext(fs.readFileSync(new URL(`../src/${name}.js`, import.meta.url), 'utf8'), context);
  const panel = { currentContentPage: '408', addon: { window: {} }, webView: { evaluateJavaScript(script, cb) { scripts.push(script); cb(true, null); } } };
  context.self = panel;
  return { panel, calls, messages, scripts,
    send(command) { return methods.webViewShouldStartLoadWithRequestNavigationType(panel.webView, { URL: { absoluteString: 'daguanyuanbridge://' + command + '?payload=' + encodeURIComponent(JSON.stringify(target)) } }); },
    complete() { resolve({ ...target, id: 843 }); }, fail() { reject(Error('题目读取失败')); },
    sendMath() { return methods.webViewShouldStartLoadWithRequestNavigationType(panel.webView, { URL: { absoluteString: 'daguanyuanbridge://locate-card?id=3356' } }); },
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

test('408 添加笔记接入自身粘贴模块，独立开关和导入锁生效', async () => {
  const run = runtime({ locate: false }); run.send('add-note'); run.complete(); await tick();
  assert.deepEqual(run.calls[1], ['note', { ...target, id: 843 }]);
  assert.match(run.messages.at(-1), /等待 408 网站保存/);
  for (const lock of ['categoryImportBusy', 'singleImportBusy']) {
    const busy = runtime(); busy.panel[lock] = true; busy.send('add-note');
    assert.equal(busy.calls.length, 0); assert.match(busy.messages.at(-1), /请稍后重试/);
    assert.match(busy.scripts.at(-1), /finishNotePaste/);
  }
  for (const [command, setting] of [['locate-card', 'locate'], ['add-note', 'note']]) {
    const off = runtime({ [setting]: false }); off.send(command);
    assert.equal(off.calls.length, 0); assert.match(off.messages.at(-1), /开关/);
  }
});

test('408 工具读取失败或空剪贴板时恢复按钮并返回原因', async () => {
  const lookup = runtime(); lookup.send('locate-card'); lookup.fail(); await tick();
  assert.equal(lookup.panel.questionToolBusy, false); assert.match(lookup.scripts.at(-1), /finishLocate/);
  assert.equal(lookup.messages.at(-1), '题目读取失败');
  const empty = runtime({ noImage: true }); empty.send('add-note'); empty.complete(); await tick();
  assert.match(empty.scripts.at(-1), /finishNotePaste/); assert.equal(empty.messages.at(-1), '剪贴板中没有图片');
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
