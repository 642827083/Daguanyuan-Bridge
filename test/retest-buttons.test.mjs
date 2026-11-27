import { withMathSite } from './helpers/math-site.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const card = id => `<article data-learning-question-card><header><div><strong>第 ${id} 题</strong><span data-question-source>2015年</span></div></header><div data-question-document>题干</div></article>`;
function page() {
  const { document, Event } = parseHTML(`<html><body><li data-retest-schedule-question-id="4185"><span>2015年</span><button aria-haspopup="dialog">查看题目</button></li><section role="dialog" aria-labelledby="preview-title"><h2 id="preview-title">题目 4185</h2>${card(4185)}</section><li data-retest-question-id="3356">${card(3356)}</li></body></html>`);
  const timers = [], observers = [];
  const window = { document, location: new URL('https://www.cxyonly.fans/math/retest?view=plans'), addEventListener() {},
    setTimeout(fn, delay) { timers.push({ fn, delay }); return timers.length; }, clearTimeout() {} };
  const context = { window, document, URLSearchParams, MutationObserver: class { constructor(fn) { observers.push(fn); } observe() {} } };
  vm.createContext(context);
  for (const name of ['DaguanyuanWebsiteBridge', 'DaguanyuanRetestBridge']) vm.runInContext(withMathSite(readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8')), context);
  function flush() { for (let n = 0; n < 20 && timers.some(t => t.delay === 80); n++) timers.splice(timers.findIndex(t => t.delay === 80), 1)[0].fn(); }
  function update(locate = true, note = false, single = true) {
    vm.runInContext(context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.practiceScript(locate, note), context);
    vm.runInContext(context.__DAGUANYUAN_RETEST_BRIDGE_GLOBAL__.script(locate, note), context);
    vm.runInContext(context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.singleImportScript(single), context); flush();
  }
  return { document, window, update, flush, changed() { observers.forEach(fn => fn()); flush(); },
    click(button) { button.dispatchEvent(new Event('click', { bubbles: true })); },
    list: document.querySelector('[data-retest-schedule-question-id]'), dialog: document.querySelector('[role="dialog"]'),
    complete: document.querySelector('[data-retest-question-id]') };
}
const selector = '[data-daguanyuan-practice-locate-card]';

test('复测计划摘要无按钮，独立题目弹窗和完整复测题在来源右侧显示定位按钮', () => {
  const run = page(); run.update();
  assert.equal(run.list.querySelector(selector), null);
  for (const root of [run.dialog, run.complete]) {
    const button = root.querySelector(selector);
    assert.equal(button?.textContent, '定位卡片');
    assert.equal(button.previousElementSibling, root.querySelector('[data-question-source]'));
    assert.equal(root.querySelectorAll('[data-daguanyuan-single-import]').length, 0);
  }
  run.click(run.dialog.querySelector(selector));
  assert.equal(run.document.querySelector('iframe').src, 'daguanyuanbridge://locate-card?id=4185');
});

test('弹窗切题读取新题号，关闭弹窗后旧按钮失效，列表不补回按钮', () => {
  const run = page(); run.update();
  const button = run.dialog.querySelector(selector);
  run.document.getElementById('preview-title').textContent = '题目 7980';
  run.dialog.querySelector('strong').textContent = '第 7980 题';
  run.click(button);
  assert.equal(run.document.querySelector('iframe').src, 'daguanyuanbridge://locate-card?id=7980');
  run.dialog.remove(); run.changed();
  run.click(button);
  assert.equal(run.document.querySelectorAll('iframe').length, 1);
  assert.equal(run.list.querySelector(selector), null);
});

test('显示开关和重复同步独立生效，来源按钮及网站自身操作保留', () => {
  const run = page(); run.update(true, true); run.changed(); run.changed();
  assert.equal(run.dialog.querySelectorAll(selector).length, 1);
  assert.equal(run.dialog.querySelector('[data-daguanyuan-practice-add-note]').previousElementSibling, run.dialog.querySelector(selector));
  run.update(false, true);
  assert.equal(run.dialog.querySelector(selector), null);
  assert.ok(run.dialog.querySelector('[data-daguanyuan-practice-add-note]'));
  run.update(true, false);
  assert.equal(run.dialog.querySelector('[data-daguanyuan-practice-add-note]'), null);
  assert.ok(run.list.querySelector('button[aria-haspopup="dialog"]'));
  run.window.location = new URL('https://www.cxyonly.fans/math/practice'); run.changed();
  assert.equal(run.document.querySelector(selector), null);
});

test('清理旧列表按钮，加载中或题号不明确的弹窗不生成可点击操作', () => {
  const run = page();
  run.list.insertAdjacentHTML('beforeend', '<button data-daguanyuan-locate-card="4185">定位卡片</button>');
  run.document.getElementById('preview-title').textContent = '题目预览';
  run.update();
  assert.equal(run.list.querySelector('[data-daguanyuan-locate-card]'), null);
  assert.equal(run.list.querySelector(selector), null); assert.equal(run.dialog.querySelector(selector), null);
  run.document.getElementById('preview-title').textContent = '题目 4185';
  run.dialog.querySelector('[data-learning-question-card]').remove(); run.changed();
  assert.equal(run.dialog.querySelector(selector), null);
});

test('复测弹窗禁止显示导入本题，隐藏弹窗不保留工具', () => {
  const run = page(); run.update();
  assert.equal(run.document.querySelector('[data-daguanyuan-single-import]'), null);
  run.dialog.setAttribute('hidden', ''); run.changed();
  assert.equal(run.dialog.querySelectorAll('[data-daguanyuan-question-target]').length, 0);
});
