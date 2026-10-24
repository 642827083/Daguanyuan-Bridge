import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parseHTML } from 'linkedom';

const source = name => fs.readFileSync(new URL('../src/' + name + '.js', import.meta.url), 'utf8');
function host() {
  const { document } = parseHTML('<html><body><div class="question-card"><button class="action-btn-ai">AI辅导</button></div></body></html>');
  const messages = [], timers = []; let now = 0, clicks = 0;
  const url = 'https://www.408os.cn/exercise?questionId=42';
  const window = { location: { href: url, search: '?questionId=42' } };
  const button = document.querySelector('button'); button.getClientRects = () => [1]; button.click = () => { clicks++; };
  const context = vm.createContext({ document, window, URLSearchParams, Date: { now: () => now },
    Application: { sharedInstance: () => ({ showHUD: text => messages.push(text) }) },
    NSTimer: { scheduledTimerWithTimeInterval(interval, repeated, callback) { const t = { callback, invalidate() { this.cancelled = true; } }; timers.push(t); return t; } }
  });
  vm.runInContext(source('DaguanyuanAskAi'), context);
  const c = { panelVisible: true, currentContentPage: '408', webView: { evaluateJavaScript(code, done) { done(vm.runInContext(code, context)); } } };
  return { context, api: context.__DAGUANYUAN_AI_GLOBAL__, document, window, c, url, messages,
    clicks: () => clicks, next() { const t = timers.shift(); if (t && !t.cancelled) t.callback(); }, setTime(n) { now = n; } };
}

test('408 点击网站原有 AI 一次，等待打开确认，不重复点击或提交', () => {
  const h = host(); h.api.open408(h.c, h.url, 42); h.next(); assert.equal(h.clicks(), 1);
  h.next(); h.next(); assert.equal(h.clicks(), 1);
  const pane = h.document.createElement('aside'); pane.className = 'ai-workspace'; pane.innerHTML = '<section class="question-ai-tutor"></section>';
  pane.getClientRects = () => [1]; h.document.body.appendChild(pane); h.next();
  assert.equal(h.c.askAiRequest, null); assert.equal(h.messages.length, 0);
});

test('408 多卡、身份不符与年份定位未完成均不能误开 AI', () => {
  const h = host();
  assert.equal(h.api.pageProbe(h.url, 43, false), 'left');
  const extra = h.document.querySelector('.question-card').cloneNode(true); h.document.body.appendChild(extra);
  assert.equal(h.api.pageProbe(h.url, 42, false), 'loading'); extra.remove();
  h.window.location.search = '?year=2023&questionId=42'; h.window.location.href = 'https://www.408os.cn/exercise' + h.window.location.search;
  assert.equal(h.api.pageProbe(h.window.location.href, 42, false), 'loading');
  h.document.documentElement.setAttribute('data-daguanyuan-408-question-locator', 'success:year:2023:42');
  assert.equal(h.api.pageProbe(h.window.location.href, 42, false), 'clicked'); assert.equal(h.clicks(), 1);
});

test('408 关闭、切页、重复请求、超时与异步回调过期后停止', () => {
  for (const action of ['hide', 'route', 'page', 'settings', 'replace', 'timeout', 'callback']) {
    const h = host(); let done;
    h.api.open408(h.c, h.url, 42);
    if (action === 'callback') h.c.webView.evaluateJavaScript = (code, callback) => { done = callback; };
    h.next();
    if (action === 'hide') h.c.panelVisible = false;
    if (action === 'route') { h.window.location.href = 'https://www.408os.cn/exercise?questionId=43'; h.window.location.search = '?questionId=43'; }
    if (action === 'page') h.c.currentContentPage = 'math';
    if (action === 'settings') h.c.activePage = 'settings';
    if (action === 'replace') { h.api.open408(h.c, h.url, 42); h.api.cancel(h.c); }
    if (action === 'timeout') h.setTime(26000);
    if (action === 'callback') { h.api.cancel(h.c); done('clicked'); }
    h.next(); assert.equal(h.c.askAiRequest, null, action);
    assert.equal(h.messages.length, action === 'timeout' ? 1 : 0);
  }
});

test('大观园数学直接打开本题 AI，408 问 AI 从分类改用单题入口，原题逻辑保留', () => {
  const calls = [], c = {};
  const context = vm.createContext({ showPanel() {}, loadURL(controller, url) { calls.push(url); }, showMessage() {},
    __DAGUANYUAN_AI_GLOBAL__: { open408(controller, url, id) { calls.push([url, id]); } } });
  vm.runInContext(source('Daguanyuan408Routes'), context);
  const panel = source('WebPanelController'), start = panel.indexOf('function openDaguanyuanQuestion(controller, route)');
  vm.runInContext(panel.slice(start, panel.indexOf('function open408Question', start)), context);
  context.openDaguanyuanQuestion(c, { askAi: true, imported: true, provider: 'math', questionId: 42, url: 'https://www.cxyonly.fans/math/practice/categories/8' });
  assert.equal(calls[0], 'https://www.cxyonly.fans/math/questions/42?assistant=1');
  context.openDaguanyuanQuestion(c, { askAi: true, imported: true, provider: '408', questionId: 42, year: 0, url: 'https://www.408os.cn/exercise?knowledgeId=53' });
  assert.equal(calls[1], 'https://www.408os.cn/exercise?questionId=42'); assert.equal(calls[2][1], 42);
});
