import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';
import { withMathSite } from './helpers/math-site.mjs';
import build from '../scripts/build-web.js';

function runtime() {
  const { document, Event } = parseHTML('<html><head></head><body><aside id="clock">时间</aside><main><li data-learning-question-id="42"><article data-learning-question-card><header><div><strong>1</strong><span data-question-source>来源</span></div></header><article class="question-document" data-question-id="42">题干</article></article></li></main></body></html>');
  const observers = [], timers = [], events = {};
  const window = { document, location: new URL('https://math.cxyonly.fans/practice/8'), innerHeight: 700,
    addEventListener(name, fn) { (events[name] ||= []).push(fn); },
    setTimeout(fn, delay = 0) { const timer = { fn, delay, active: true }; timers.push(timer); return timer; },
    clearTimeout(timer) { if (timer && typeof timer === 'object') timer.active = false; } };
  const context = vm.createContext({ window, document, location: window.location, URL, URLSearchParams, console,
    setTimeout: window.setTimeout, MutationObserver: class {
      constructor(fn) { this.fn = fn; observers.push(this); }
      observe() {}
      disconnect() { this.off = true; }
    } });
  for (const name of ['DaguanyuanCategoryRoutes', 'DaguanyuanWebsiteBridge']) vm.runInContext(withMathSite(fs.readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8')), context);
  const bridge = context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(bridge.practiceScript(true, true), context);
  vm.runInContext(bridge.singleImportScript(true), context);
  vm.runInContext(bridge.bindCategoryScript(true, true, true), context);
  vm.runInContext(build.pageScript(), context);
  const flush = () => { for (let i = 0; timers.length && i < 100; i++) { const t = timers.shift(); if (t.active && t.delay < 1000) t.fn(); } };
  flush();
  let reads = 0, clones = 0;
  const dom = window.__DAGUANYUAN_QUESTION_DOM__, read = dom.read;
  dom.read = function () { reads++; return read(); };
  const row = document.querySelector('[data-learning-question-id]'), article = row.querySelector('article.question-document'), clone = article.cloneNode;
  article.cloneNode = function (...args) { clones++; return clone.apply(this, args); };
  return { context, window, document, Event, bridge, flush, timers, events, row,
    reads: () => reads, clones: () => clones,
    mutate(record) { observers.filter(o => !o.off).forEach(o => o.fn([record])); flush(); } };
}

test('网页无关区域和插件自身界面变化不再扫描题目，相关内容变化仍显示三个按钮', () => {
  const run = runtime();
  const clock = run.document.getElementById('clock');
  for (let i = 0; i < 100; i++) run.mutate({ type: 'childList', target: clock, addedNodes: [run.document.createTextNode('时间' + i)], removedNodes: [] });
  run.mutate({ type: 'childList', target: run.document.getElementById('dgy-dialog'), addedNodes: [run.document.createElement('p')], removedNodes: [] });
  const own = run.document.querySelector('[data-daguanyuan-question-target]');
  run.mutate({ type: 'childList', target: own, addedNodes: [run.document.createTextNode('定位中')], removedNodes: [] });
  assert.equal(run.reads(), 0);
  run.row.querySelector('[data-question-source]').textContent = '新来源';
  run.mutate({ type: 'childList', target: run.row.querySelector('header'), addedNodes: [], removedNodes: [] });
  assert.ok(run.reads() > 0);
  assert.equal(run.document.querySelectorAll('[data-daguanyuan-question-target]').length, 3);
});

test('分类入口日常刷新不克隆题干，选题快照仍有摘要；翻题、搜索弹窗与开关仍刷新', () => {
  const run = runtime();
  run.window.__DAGUANYUAN_IMPORT_UI__.refresh();
  assert.equal(run.clones(), 0);
  const toolbar = run.document.getElementById('dgy-toolbar');
  assert.equal(toolbar.querySelector('[data-scope="selected"]').disabled, false);
  toolbar.querySelector('[data-scope="selected"]').dispatchEvent(new run.Event('click', { bubbles: true }));
  const snapshot = JSON.parse(run.window.__DAGUANYUAN_IMPORT_UI__.pageSnapshot());
  assert.equal(snapshot.questions[0].summary, '题干');
  assert.equal(run.clones(), 1);
  run.row.setAttribute('data-learning-question-id', '43');
  run.row.querySelector('article.question-document').setAttribute('data-question-id', '43');
  run.mutate({ type: 'attributes', target: run.row, attributeName: 'data-learning-question-id' });
  assert.equal(JSON.parse(run.document.querySelector('[data-daguanyuan-single-import]').getAttribute('data-daguanyuan-question-target')).id, 43);
  vm.runInContext(run.bridge.singleImportScript(false), run.context); run.flush();
  assert.equal(run.document.querySelector('[data-daguanyuan-single-import]'), null);
  const dialog = run.document.createElement('section'); dialog.setAttribute('role', 'dialog');
  dialog.innerHTML = '<h2>题目 99</h2><div data-question-preview-loaded><article data-learning-question-card><header><div><strong>99</strong><span data-question-source>搜索来源</span></div></header><article class="question-document" data-question-id="99">搜索题干</article></article></div>';
  run.document.body.appendChild(dialog);
  run.mutate({ type: 'childList', target: run.document.body, addedNodes: [dialog], removedNodes: [] });
  assert.ok(run.document.querySelector('[data-daguanyuan-practice-locate-card="99"]'));
  dialog.remove();
  run.mutate({ type: 'childList', target: run.document.body, addedNodes: [], removedNodes: [dialog] });
  assert.ok(run.document.querySelector('[data-daguanyuan-practice-locate-card="43"]'));
});

test('路由变动、祖先可见性和分类控件变化仍刷新，旧接收器升级后不重复安装', () => {
  const run = runtime();
  const tools = run.window.__DAGUANYUAN_QUESTION_TOOLS__, observer = tools.observer;
  vm.runInContext(run.bridge.practiceScript(true, true), run.context); run.flush();
  assert.equal(run.window.__DAGUANYUAN_QUESTION_TOOLS__.observer, observer);
  const control = run.document.createElement('div'); control.className = 'learning-shell__scope-toggle'; run.document.body.appendChild(control);
  run.mutate({ type: 'attributes', target: control, attributeName: 'data-scope' });
  const reads = run.reads(); assert.ok(reads > 0);
  run.mutate({ type: 'attributes', target: run.document.querySelector('main'), attributeName: 'inert' });
  assert.ok(run.reads() > reads);
  run.window.location = new URL('https://math.cxyonly.fans/settings'); run.context.location = run.window.location;
  run.mutate({ type: 'childList', target: run.document.getElementById('clock'), addedNodes: [], removedNodes: [] });
  assert.equal(run.document.querySelectorAll('[data-daguanyuan-question-target]').length, 0);
  tools.version = 8;
  vm.runInContext(run.bridge.practiceScript(true, true), run.context); run.flush();
  assert.equal(observer.off, true);
  assert.notEqual(run.window.__DAGUANYUAN_QUESTION_TOOLS__.observer, observer);
});
