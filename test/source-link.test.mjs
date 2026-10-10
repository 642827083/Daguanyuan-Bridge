import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function runtime() {
  const calls = [], windows = [{}, {}], application = { focusWindow: windows[0] };
  const context = { console, Application: { sharedInstance() { return application; } },
    MNUtil: { currentWindow: windows[0], addObserver(...args) { calls.push(['add', ...args]); }, removeObserver(...args) { calls.push(['remove', ...args]); } },
    __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__: { enabled() { return true; }, showMessage(addon, message) { calls.push(['message', message]); } },
    __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__: { show() {}, hide() {}, remove() {}, syncQuestionLocator() {} },
    __DAGUANYUAN_WEB_PANEL_GLOBAL__: {
      createController(addon) { calls.push(['create', addon.window]); return {}; },
      openDaguanyuanQuestion(panel, route) { calls.push(['open', panel, route]); },
      shouldRestorePanel() { return false; },
    },
    JSB: { defineClass(name, methods) { return methods; } },
  };
  vm.createContext(context);
  for (const file of ['DaguanyuanSourceLink', 'WebAddon']) vm.runInContext(fs.readFileSync(new URL('../src/' + file + '.js', import.meta.url), 'utf8'), context);
  return { context, calls, windows, application, source: context.__DAGUANYUAN_SOURCE_LINK_GLOBAL__ };
}

for (const [provider, id, url, year] of [
  ['math', 1214, 'https://www.cxyonly.fans/math/practice/321?resumeCategoryId=345&questionId=1214', 0],
  ['408', 843, 'https://www.408os.cn/exercise?year=2026&questionId=843', 2026],
  ['408', 44, 'https://www.408os.cn/exercise?knowledgeId=7&knowledgeName=函数(x)&sourcePage=abc', 2009],
]) test(provider + ' 原题链接携带实际题目、分类和年份，在面板接收时还原', () => {
  const run = runtime(), link = run.source.link(provider, id, url, year);
  assert.doesNotMatch(link, /[()\s]/);
  const route = run.source.parse(link.replace('marginnote4app://addon/', ''));
  assert.equal(route.url, url); assert.equal(route.questionId, id); assert.equal(route.provider, provider);
  assert.equal(route.year, year); assert.equal(route.imported, true);
  const addon = { window: run.windows[0] };
  assert.equal(run.source.receive(addon, { userInfo() { return { message: link.replace('marginnote4app://addon/', '') }; } }), true);
  assert.equal(run.calls[1][0], 'open'); assert.equal(run.calls[1][2].url, url);
});

test('错误插件消息、非法 ID、外站 URL 和破损编码不会打开面板', () => {
  const run = runtime(), prefix = 'daguanyuan-bridge?action=open&provider=math&question=1&year=0&url=';
  for (const message of [null, 'other?action=open', prefix + '%', prefix + encodeURIComponent('https://example.com/math/practice/1'),
    prefix + encodeURIComponent('https://www.cxyonly.fans.evil.com/math/practice/1'),
    prefix + encodeURIComponent('https://www.cxyonly.fans/math/practice/1') + '&extra=1',
    prefix.replace('question=1', 'question=9007199254740992') + encodeURIComponent('https://www.cxyonly.fans/math/practice/1')]) {
    assert.equal(run.source.receive({ window: run.windows[0] }, { userInfo: { message } }), false);
  }
  assert.equal(run.calls.length, 0);
  assert.throws(() => run.source.link('unknown', 1, 'https://www.408os.cn/exercise?year=2026'), /无效/);
});

test('原题广播仅在当前窗口打开，面板已存在时复用，不依赖选中卡片', () => {
  const run = runtime(), panel = {}, addon = { window: run.windows[0], panelController: panel };
  const message = run.source.link('math', 7, 'https://www.cxyonly.fans/math/practice/1').replace('marginnote4app://addon/', '');
  assert.equal(run.source.receive({ window: run.windows[1] }, { userInfo: { message } }), false);
  assert.equal(run.source.receive(addon, { userInfo: { message } }), true);
  assert.equal(run.calls.length, 1); assert.equal(run.calls[0][1], panel);
  delete run.context.MNUtil.currentWindow;
  assert.equal(run.source.receive(addon, { userInfo: { message } }), true);
  run.application.focusWindow = null;
  assert.equal(run.source.receive(addon, { userInfo: { message } }), false);
});

test('窗口生命周期注册一次通知，关闭时移除，重开可以再次注册', () => {
  const run = runtime(), addon = { window: run.windows[0] };
  run.context.self = addon;
  const methods = run.context.createDaguanyuanBridgeAddon();
  methods.sceneWillConnect(); methods.notebookWillOpen();
  assert.equal(run.calls.filter(call => call[0] === 'add').length, 1);
  assert.equal(run.calls.find(call => call[0] === 'add')[2], 'onSourceLink:');
  const message = run.source.link('math', 7, 'https://www.cxyonly.fans/math/practice/1').replace('marginnote4app://addon/', '');
  methods.onSourceLink({ userInfo: { message } });
  assert.equal(run.calls.filter(call => call[0] === 'open').length, 1);
  methods.sceneDidDisconnect(); run.source.unregister(addon);
  assert.equal(run.calls.filter(call => call[0] === 'remove').length, 1);
  methods.sceneWillConnect();
  assert.equal(run.calls.filter(call => call[0] === 'add').length, 2);
});

test('缺少 MN Utils 通知接口时明确提示，定位异常通过现有提示入口显示', () => {
  const run = runtime(), addon = { window: run.windows[0] };
  run.context.self = addon; delete run.context.MNUtil.addObserver;
  const methods = run.context.createDaguanyuanBridgeAddon(); methods.sceneWillConnect();
  assert.match(run.calls.find(call => call[0] === 'message')[1], /安装并启用.*MN Utils/);
  run.context.__DAGUANYUAN_WEB_PANEL_GLOBAL__.openDaguanyuanQuestion = () => { throw Error('定位失败'); };
  const message = run.source.link('math', 7, 'https://www.cxyonly.fans/math/practice/1').replace('marginnote4app://addon/', '');
  methods.onSourceLink({ userInfo: { message } });
  assert.equal(run.calls.at(-1)[1], '定位失败');
});

test('从查看原题评论读取唯一网址、题库和题号，无需 SOURCE_LINK 或 URL 注释', () => {
  const run = runtime(), url = 'https://www.408os.cn/exercise?knowledgeId=58&knowledgeName=Cache&sourcePage=overview&questionId=64';
  const link = run.source.link('408', 64, url, 2010);
  const comment = '[查看原题](' + link + ')\n\n<!-- DAGUANYUAN_408_QUESTION_ID:64 -->\n\n<!-- DAGUANYUAN_SOURCE_STAMP:1:a:b -->\n\n<!-- DAGUANYUAN_RENDERED_STAMP:1:a:b -->';
  const route = run.source.fromComment(comment);
  assert.equal(route.provider, '408'); assert.equal(route.questionId, 64); assert.equal(route.year, 2010); assert.equal(route.url, url);
  assert.equal(run.source.fromComment(comment.replaceAll('\n', '\r\n')).url, url);
  assert.equal(run.source.fromComment('  ' + comment).url, url);
  assert.equal(run.source.fromComment(comment + '\n' + comment), null);
  assert.equal(run.source.fromComment(comment.replace('&url=', '&wrong=')), null);
  assert.equal(run.source.fromComment('<!-- DAGUANYUAN_408_URL:' + url + ' -->'), null);
});
