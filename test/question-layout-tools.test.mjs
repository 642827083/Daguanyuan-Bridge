import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

function page(path, focus, wrapped) {
  const metadata = '<span data-question-source>2024年 数一 第1题</span>';
  const card = '<article data-learning-question-card><header><div><strong>第 1 题</strong>' + (focus ? '' : metadata) + '</div></header>'
    + (focus ? '<div data-focus-question-metadata>' + metadata + '</div>' : '')
    + '<article class="question-document" data-question-id="1214">题干</article></article>';
  const html = wrapped ? '<li data-learning-question-id="1214" data-retest-question-id="1214">' + card + '</li>' : card;
  const { document, Event } = parseHTML('<html><body><li data-retest-schedule-question-id="99"><button>查看题目</button></li>' + html + '</body></html>');
  const timers = [], window = { location: new URL('https://www.cxyonly.fans' + path), addEventListener() {},
    setTimeout(fn, delay) { timers.push({ fn, delay }); return timers.length; }, clearTimeout() {} };
  const context = { window, document, URLSearchParams, MutationObserver: class { observe() {} } };
  vm.createContext(context);
  for (const name of ['DaguanyuanWebsiteBridge', 'DaguanyuanRetestBridge']) vm.runInContext(readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8'), context);
  const bridge = context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  function flush() { for (let i = 0; i < 20 && timers.some(t => t.delay === 80); i++) timers.splice(timers.findIndex(t => t.delay === 80), 1)[0].fn(); }
  function update(locate = true, single = true) {
    vm.runInContext(bridge.practiceScript(locate, false), context);
    vm.runInContext(context.__DAGUANYUAN_RETEST_BRIDGE_GLOBAL__.script(locate, false), context);
    vm.runInContext(bridge.singleImportScript(single), context); flush();
  }
  return { document, window, update, flush, click(button) { button.dispatchEvent(new Event('click', { bubbles: true })); } };
}

test('同页切换到新布局时移动已有按钮，答案中的重复题号不产生重复工具', () => {
  const run = page('/math/practice', false, false); run.update();
  const card = run.document.querySelector('[data-learning-question-card]');
  const button = run.document.querySelector('[data-daguanyuan-practice-locate-card]');
  card.insertAdjacentHTML('beforeend', '<div data-focus-question-metadata><button data-question-source>2024年</button></div><article class="question-document" data-question-id="1214">答案</article>');
  run.update();
  const info = card.querySelector('[data-focus-question-metadata]');
  assert.equal(info.querySelector('[data-daguanyuan-practice-locate-card]'), button);
  assert.equal(run.document.querySelectorAll('[data-daguanyuan-question-target]').length, 2);
  assert.equal(info.querySelectorAll('[data-daguanyuan-question-target]').length, 2);
});

for (const path of ['/math/practice/categories/345', '/math/practice/concepts/345', '/math/practice/exam-by-year-math_1/all/345', '/math/retest?view=practice', '/math/retest/practice']) for (const focus of [false, true]) for (const wrapped of [false, true]) {
  test(`${path} ${focus ? '新布局' : '旧布局'} ${wrapped ? '有题目外层' : '独立题卡'}按页面显示工具，切题后回传真实题号`, () => {
    const run = page(path, focus, wrapped); run.update(); run.update();
    const info = run.document.querySelector(focus ? '[data-focus-question-metadata]' : '[data-learning-question-card] > header > div');
    const retest = path.startsWith('/math/retest');
    assert.deepEqual([...info.querySelectorAll('[data-daguanyuan-question-target]')].map(b => b.textContent), retest ? ['定位卡片'] : ['定位卡片', '导入本题']);
    assert.equal(run.document.querySelectorAll('[data-daguanyuan-question-target]').length, retest ? 1 : 2);
    assert.equal(run.document.querySelector('[data-retest-schedule-question-id]').querySelectorAll('[data-daguanyuan-question-target]').length, 0);
    run.document.querySelector('.question-document').setAttribute('data-question-id', '7980');
    const wrapper = run.document.querySelector('[data-learning-question-id]');
    if (wrapper) wrapper.setAttribute('data-learning-question-id', '7980');
    run.click(info.querySelector('[data-daguanyuan-practice-locate-card]'));
    assert.equal(run.document.querySelector('iframe').src, 'daguanyuanbridge://locate-card?id=7980');
    run.window.__DAGUANYUAN_QUESTION_TOOLS__.finishLocate(); run.flush();
    if (!retest) {
      run.click(info.querySelector('[data-daguanyuan-single-import]'));
      const payload = JSON.parse(decodeURIComponent(run.document.querySelectorAll('iframe')[1].src.split('payload=')[1]));
      assert.equal(payload.id, 7980); assert.equal(payload.url, run.window.location.href);
    } else assert.equal(info.querySelector('[data-daguanyuan-single-import]'), null);
    run.update(false, true); assert.equal(run.document.querySelector('[data-daguanyuan-practice-locate-card]'), null);
    run.update(true, false); assert.equal(run.document.querySelector('[data-daguanyuan-single-import]'), null);
  });
}

test('练题页转入复测后清理原有导入按钮，回到练题页恢复，页面规则不改变开关', () => {
  const run = page('/math/practice/concepts/345', true, true); run.update();
  assert.ok(run.document.querySelector('[data-daguanyuan-single-import]'));
  run.window.location = new URL('https://www.cxyonly.fans/math/retest/practice');
  run.window.__DAGUANYUAN_QUESTION_TOOLS__.schedule(); run.flush();
  assert.equal(run.document.querySelector('[data-daguanyuan-single-import]'), null);
  assert.ok(run.document.querySelector('[data-daguanyuan-practice-locate-card]'));
  run.window.location = new URL('https://www.cxyonly.fans/math/practice/exam/all/345');
  run.window.__DAGUANYUAN_QUESTION_TOOLS__.schedule(); run.flush();
  assert.ok(run.document.querySelector('[data-daguanyuan-single-import]'));
});
