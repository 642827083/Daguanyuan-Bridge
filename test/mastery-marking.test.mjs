import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function browser(options = {}) {
  const storage = new Map([['daguan_token', 'test-token'], ['daguan_user', '{"id":7,"role":"user"}']]);
  const calls = [], locks = [];
  const context = { location: new URL('https://www.cxyonly.fans/math/practice/categories/345'),
    localStorage: { getItem: key => storage.get(key) }, AbortController, URLSearchParams, setTimeout, clearTimeout,
    navigator: { locks: { request(key, callback) { locks.push(key); return callback(); } } },
    fetch: async (path, init) => {
      calls.push({ path, init });
      if (options.fetch) return options.fetch(path, init, calls);
      return { ok: true, json: async () => ({ code: 0, message: '', data: path.includes('/retest/queue?') ? { items: [], total: 0 }
        : path.includes('csrf') ? { csrf_token: 'csrf-test' } : { mastery: JSON.parse(init.body).mastery } }) };
    }
  };
  context.window = context;
  vm.runInNewContext(read('web/src/DaguanyuanMasteryPage.js'), context);
  return { context, storage, calls, locks, api: context.__DAGUANYUAN_MASTERY_PAGE__ };
}
for (const mastery of ['needs_practice', 'not_known', 'mastered']) test('同步正确题目和状态，凭据留在网页：' + mastery, async () => {
  const run = browser();
  assert.equal(run.api.begin('task-1', 1214, mastery), 'ok'); await tick();
  const result = run.api.read('task-1');
  assert.equal(JSON.parse(result).status, 'ready');
  assert.equal(JSON.parse(result).mode, 'mastery');
  assert.equal(run.calls[2].path, '/api/questions/1214/state');
  assert.equal(run.calls[2].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(run.calls[2].init.body), { mastery });
  assert.equal(run.calls[2].init.headers['X-CSRF-Token'], 'csrf-test');
  assert.equal(run.calls[2].init.headers.Authorization, 'Bearer test-token');
  assert.equal(run.calls[2].init.redirect, 'error');
  assert.deepEqual(run.locks, ['daguan:question-state:7:1214']);
  assert.doesNotMatch(result, /test-token|csrf-test/);
  run.api.release('task-1');
});
test('未登录、外站、非法题目和非法状态均不发送请求', () => {
  for (const kind of ['anonymous', 'foreign', 'id', 'level']) {
    const run = browser();
    if (kind === 'anonymous') run.storage.clear();
    if (kind === 'foreign') run.context.location = new URL('https://www.408os.cn/exercise');
    assert.throws(() => run.api.begin('t', kind === 'id' ? -1 : 1, kind === 'level' ? 'favorite' : 'mastered'));
    assert.equal(run.calls.length, 0);
  }
});
for (const status of [401, 403, 429, 503]) test('网站错误不伪报成功，不自动重复写入：' + status, async () => {
  const run = browser({ fetch: async path => path.includes('csrf') ? { ok: true, json: async () => ({ csrf_token: 'csrf-test' }) } : { ok: false, status } });
  run.api.begin('t', 1, 'mastered'); await tick();
  assert.equal(JSON.parse(run.api.read('t')).status, 'error');
  assert.match(JSON.parse(run.api.read('t')).error, new RegExp(status === 401 ? '登录' : String(status)));
  assert.equal(run.calls.length, 1); run.api.release('t');
});
test('账号切换或路由变化阻止后续写入，完成后切账号不接受旧回执', async () => {
  const run = browser({ fetch: async () => { run.storage.set('daguan_user', '{"id":8}'); return { ok: true, json: async () => ({ csrf_token: 'csrf-test' }) }; } });
  run.api.begin('t', 1, 'mastered'); await tick(); assert.equal(run.calls.length, 1);
  assert.throws(() => run.api.read('t'), /账号已切换/); run.api.release('t');
  const ready = browser(); ready.api.begin('t', 1, 'mastered'); await tick();
  ready.context.location = new URL('https://www.cxyonly.fans/math');
  assert.throws(() => ready.api.read('t'), /页面或登录账号/); ready.api.release('t');
});
test('拒绝重复任务、错误回执和服务端业务失败', async () => {
  for (const payload of [{ mastery: 'not_known' }, { code: 4, message: 'failed', data: null }, null]) {
    const run = browser({ fetch: async path => ({ ok: true, json: async () => path.includes('/retest/queue?') ? { items: [], total: 0 }
      : path.includes('csrf') ? { csrf_token: 'csrf-test' } : payload }) });
    run.api.begin('t', 1, 'mastered'); assert.throws(() => run.api.begin('t2', 2, 'mastered'), /正在同步/);
    await tick(); assert.equal(JSON.parse(run.api.read('t')).status, 'error'); run.api.release('t');
  }
});
test('取消进行中的任务会中止请求且不会继续写入', async () => {
  let complete;
  const run = browser({ fetch: () => new Promise(resolve => { complete = resolve; }) });
  run.api.begin('t', 1, 'mastered'); await tick();
  const signal = run.calls[0].init.signal; run.api.release('t');
  assert.equal(signal.aborted, true);
  complete({ ok: true, json: async () => ({ csrf_token: 'csrf-test' }) }); await tick();
  assert.equal(run.calls.length, 1); assert.throws(() => run.api.read('t'), /已失效/);
});

function retestBrowser(options = {}) {
  const schedule = { active: true, revision: 8, due_status: 'due_today', ...options.schedule };
  const queue = options.queue === undefined ? { items: [{ question: { id: 1214 }, schedule }], total: 1 } : options.queue;
  return browser({ fetch: async (path, init) => {
    if (options.fetch) return options.fetch(path, init);
    let data;
    if (path.includes('/retest/queue?')) data = queue;
    else if (path.includes('csrf')) data = { csrf_token: 'csrf-test' };
    else if (path.endsWith('/review')) {
      if (options.status) return { ok: false, status: options.status };
      if (options.networkFailure) throw new TypeError('连接已断开');
      const mastery = JSON.parse(init.body).mastery;
      data = options.receipt === undefined ? { review: { outcome: mastery, next_due_on: '2026-10-18' },
        user_state: { mastery }, schedule: { active: mastery !== 'mastered', revision: 9 } } : options.receipt;
    } else data = { mastery: JSON.parse(init.body).mastery };
    return { ok: true, json: async () => ({ code: 0, message: '', data }) };
  } });
}

for (const mastery of ['needs_practice', 'not_known', 'mastered']) {
  for (const due of ['due_today', 'overdue', 'upcoming']) test('有效计划在任意页面提交本次复测：' + mastery + '/' + due, async () => {
    const run = retestBrowser({ schedule: { due_status: due } });
    run.context.location = new URL('https://www.cxyonly.fans/math/paper');
    run.api.begin('review-1', 1214, mastery); await tick();
    const result = run.api.read('review-1');
    assert.equal(JSON.parse(result).status, 'ready'); assert.equal(JSON.parse(result).mode, 'retest');
    const query = new URL(run.calls[0].path, 'https://www.cxyonly.fans').searchParams;
    assert.equal(query.get('include_upcoming'), 'true'); assert.equal(query.get('scope'), 'complete');
    assert.deepEqual(JSON.parse(query.get('filters')), { match: 'all', conditions: [{ field: 'question_id', operator: 'between', value: [1214, 1214] }] });
    const writes = run.calls.filter(c => c.init.method === 'POST' || c.init.method === 'PATCH');
    assert.equal(writes.length, 1); assert.equal(writes[0].path, '/api/retest/questions/1214/review');
    assert.equal(writes[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(writes[0].init.body), { mastery, early: due === 'upcoming', expected_revision: 8 });
    assert.equal(writes[0].init.headers['Idempotency-Key'], 'retest-review:1214:' + mastery + ':review-1');
    assert.equal(writes[0].init.headers['X-CSRF-Token'], 'csrf-test');
    assert.doesNotMatch(result, /test-token|csrf-test/); run.api.release('review-1');
  });
}

test('已退出复测计划的题仍然只修改普通掌握状态', async () => {
  const run = retestBrowser({ schedule: { active: false } });
  run.api.begin('t', 1214, 'not_known'); await tick();
  assert.equal(JSON.parse(run.api.read('t')).mode, 'mastery');
  assert.equal(run.calls[2].path, '/api/questions/1214/state');
  assert.deepEqual(JSON.parse(run.calls[2].init.body), { mastery: 'not_known' }); run.api.release('t');
});

test('计划查询不完整、题号不匹配或计划损坏时禁止写入', async () => {
  const item = { question: { id: 1214 }, schedule: { active: true, revision: 8, due_status: 'due_today' } };
  const queues = [null, {}, { items: [], total: 1 }, { items: [item], total: 2 }, { items: [item, item], total: 2 },
    { items: [{ ...item, question: { id: 1 } }], total: 1 },
    ...[null, {}, { active: true, due_status: 'due_today' }, { active: true, revision: 8, due_status: 'invalid' }]
      .map(schedule => ({ items: [{ ...item, schedule }], total: 1 }))];
  for (const queue of queues) {
    const run = retestBrowser({ queue }); run.api.begin('t', 1214, 'mastered'); await tick();
    assert.equal(JSON.parse(run.api.read('t')).status, 'error');
    assert.equal(run.calls.length, 1); run.api.release('t');
  }
});

for (const status of [401, 403, 409, 429, 503]) test('复测提交失败不补发普通标记、不重复提交：' + status, async () => {
  const run = retestBrowser({ status }); run.api.begin('t', 1214, 'mastered'); await tick();
  const result = JSON.parse(run.api.read('t'));
  assert.equal(result.status, 'error');
  assert.match(result.error, new RegExp(status === 401 ? '登录' : status === 409 ? '其他页面更新' : String(status)));
  assert.equal(run.calls.filter(c => c.init.method === 'POST').length, 1);
  assert.equal(run.calls.filter(c => c.init.method === 'PATCH').length, 0); run.api.release('t');
});

test('复测网络中断或回执错误时不伪报成功、不降级写入', async () => {
  for (const options of [{ networkFailure: true }, { receipt: null },
    { receipt: { review: { outcome: 'not_known' }, user_state: { mastery: 'mastered' }, schedule: { revision: 9 } } },
    { receipt: { review: { outcome: 'mastered' }, user_state: { mastery: 'mastered' }, schedule: { revision: 8 } } }]) {
    const run = retestBrowser(options); run.api.begin('t', 1214, 'mastered'); await tick();
    assert.equal(JSON.parse(run.api.read('t')).status, 'error');
    assert.equal(run.calls.filter(c => c.init.method === 'POST').length, 1);
    assert.equal(run.calls.filter(c => c.init.method === 'PATCH').length, 0); run.api.release('t');
  }
});

test('取消查询或查询后切换页面时不提交复测', async () => {
  for (const action of ['cancel', 'route']) {
    let complete;
    const run = retestBrowser({ fetch: () => new Promise(resolve => { complete = resolve; }) });
    run.api.begin('t', 1214, 'mastered'); await tick();
    if (action === 'cancel') run.api.release('t');
    else run.context.location = new URL('https://www.cxyonly.fans/math/retest');
    complete({ ok: true, json: async () => ({ items: [{ question: { id: 1214 }, schedule: { active: true, revision: 8, due_status: 'due_today' } }], total: 1 }) });
    await tick(); assert.equal(run.calls.length, 1);
    assert.throws(() => run.api.read('t'), action === 'cancel' ? /失效/ : /页面或登录账号/); run.api.release('t');
  }
});

function nativeUI() {
  class View {
    constructor(frame) { this.frame = frame; this.bounds = { ...frame }; this.layer = {}; this.titleLabel = {}; this.children = []; this.events = []; }
    addSubview(view) { this.children.push(view); view.superview = this; }
    removeFromSuperview() { if (this.superview) this.superview.children = this.superview.children.filter(item => item !== this); this.superview = null; }
    setTitleForState(text) { this.title = text; }
    setTitleColorForState(color) { this.textColor = color; }
    addTargetActionForControlEvents(owner, selector, event) { this.events.push([owner, selector, event]); }
  }
  const stored = new Map(), timers = [], observers = [], writes = [], messages = [], window = {};
  const notebook = { notebookId: 'nb' }, view = new View({ x: 0, y: 40, width: 900, height: 600 });
  const context = { UIView: View, UIButton: View, UILabel: View, UISwitch: View, console,
    NSUserDefaults: { standardUserDefaults: () => ({ objectForKey: key => stored.get(key), setObjectForKey: (flag, key) => stored.set(key, flag) }) },
    MNUtil: { currentWindow: window, addObserver: (...args) => observers.push(['add', ...args]), removeObserver: (...args) => observers.push(['remove', ...args]) },
    NSTimer: { scheduledTimerWithTimeInterval(delay, repeats, callback) { timers.push(callback); return { invalidate() {} }; } },
    Application: { sharedInstance: () => ({ studyController: () => ({ view, notebookController: notebook }) }) },
    UIColor: { clearColor: () => 'clear', darkGrayColor: () => 'dark', whiteColor: () => 'white', grayColor: () => 'gray', colorWithRedGreenBlueAlpha: (...args) => args,
      lightGrayColor: () => ({ colorWithAlphaComponent: () => 'border' }) },
    UIFont: { boldSystemFontOfSize: () => 'bold', systemFontOfSize: () => 'normal' },
    __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__: { showMessage: (addon, message) => messages.push(message) },
    __DAGUANYUAN_MASTERY_SYNC_GLOBAL__: { save: async (...args) => writes.push(args) },
    PopupMenu: { currentMenu: () => ({ visible: false }) }
  };
  vm.createContext(context);
  for (const name of ['DaguanyuanSourceLink', 'DaguanyuanCardComments', 'DaguanyuanMasteryUI', 'DaguanyuanCardToolsSettings', 'DaguanyuanCardRepairUI']) vm.runInContext(read('src/' + name + '.js'), context);
  const ui = context.__DAGUANYUAN_MASTERY_UI_GLOBAL__, addon = { window, panelController: {} };
  function card(id = 1214, provider = 'math', role = 'QUESTION') {
    return { noteId: 'n' + id, notebookId: 'nb', comments: [{ text: '题目正文' }, { text: context.__DAGUANYUAN_CARD_COMMENTS_GLOBAL__.metadata({ id }, provider === 'math' ? 'https://www.cxyonly.fans/math/practice/categories/345' : 'https://www.408os.cn/exercise?knowledgeId=5', provider, role) }] };
  }
  function select(note, winRect = '{{200, 140}, {350, 250}}') { notebook.focusNote = note; ui.show(addon, { userInfo: { note, winRect } }); }
  return { View, stored, timers, observers, writes, messages, context, notebook, view, addon, ui, card, select };
}

test('题卡成功提示区分复测结果与普通掌握标记', async () => {
  for (const mode of ['mastery', 'retest']) {
    const run = nativeUI();
    run.context.__DAGUANYUAN_MASTERY_SYNC_GLOBAL__.save = async () => ({ mode });
    run.ui.setEnabled(run.addon, true); run.select(run.card());
    run.ui.click(run.addon, run.addon.__daguanyuanMasteryButtons[2]); await tick();
    assert.equal(run.messages.at(-1), mode === 'retest' ? '已记录本次复测：掌握' : '已同步到大观园：掌握');
  }
});
test('点击数学题卡才出现横排黄红绿按钮，普通卡和答案卡不显示', () => {
  const run = nativeUI(), { ui, addon } = run;
  run.select(run.card()); assert.equal(addon.__daguanyuanMasteryToolbar, undefined);
  ui.setEnabled(addon, true); run.select(run.card());
  assert.equal(addon.__daguanyuanMasteryToolbar.hidden, false);
  assert.deepEqual(Array.from(addon.__daguanyuanMasteryButtons, b => b.title), ['不熟练', '不会', '掌握']);
  assert.deepEqual(Array.from(addon.__daguanyuanMasteryButtons[0].backgroundColor), [0.98, 0.77, 0.18, 1]);
  assert.ok(addon.__daguanyuanMasteryToolbar.frame.y >= 140 - 40 + 250);
  for (const card of [{ noteId: 'other', notebookId: 'nb', comments: [] }, run.card(1, '408'), run.card(2, 'math', 'ANSWER')]) {
    run.select(card); assert.equal(addon.__daguanyuanMasteryToolbar.hidden, true);
  }
});
test('只操作刚点击的卡片，关闭通知不会隐藏下一张卡，换卡后不误标', async () => {
  const run = nativeUI(), { ui, addon } = run;
  ui.setEnabled(addon, true); run.select(run.card(1)); ui.close(addon);
  run.select(run.card(2)); run.timers.shift()(); assert.equal(addon.__daguanyuanMasteryToolbar.hidden, false);
  const body = JSON.stringify(run.notebook.focusNote.comments);
  ui.press(addon, addon.__daguanyuanMasteryButtons[0]); ui.close(addon); run.timers.shift()();
  assert.equal(addon.__daguanyuanMasteryToolbar.hidden, false);
  ui.click(addon, addon.__daguanyuanMasteryButtons[0]); await tick();
  assert.equal(run.writes[0][1].questionId, 2); assert.equal(run.writes[0][2], 'needs_practice');
  assert.equal(JSON.stringify(run.notebook.focusNote.comments), body);
  run.select(run.card(3)); run.notebook.focusNote = run.card(4); ui.click(addon, addon.__daguanyuanMasteryButtons[2]);
  assert.equal(run.writes.length, 1); assert.equal(addon.__daguanyuanMasteryToolbar.hidden, true);
});
test('按钮轻点关闭宿主菜单并清空焦点时，仍然标记刚按下的题卡', async () => {
  const run = nativeUI(), { ui, addon } = run;
  ui.setEnabled(addon, true); run.select(run.card(5));
  ui.press(addon, addon.__daguanyuanMasteryButtons[1]); run.notebook.focusNote = null;
  ui.close(addon); run.timers.shift()(); ui.click(addon, addon.__daguanyuanMasteryButtons[1]); await tick();
  assert.equal(run.writes[0][1].questionId, 5); assert.equal(run.writes[0][2], 'not_known');
});
test('关闭菜单、关闭设置、禁用插件和不同窗口不留下题卡按钮', () => {
  const run = nativeUI(), { ui, addon } = run;
  ui.setEnabled(addon, true); run.select(run.card()); ui.close(addon); run.timers.shift()();
  assert.equal(addon.__daguanyuanMasteryToolbar.hidden, true);
  run.select(run.card()); ui.setEnabled(addon, false); assert.equal(addon.__daguanyuanMasteryToolbar.hidden, true);
  run.context.MNUtil.currentWindow = {}; ui.setEnabled(addon, true); run.select(run.card()); assert.equal(addon.__daguanyuanMasteryToolbar.hidden, true);
  run.context.MNUtil.currentWindow = addon.window; run.select(run.card()); ui.unregister(addon);
  assert.equal(run.view.children.length, 0); assert.equal(run.observers.filter(item => item[0] === 'remove').length, 2);
});
test('位置适应屏幕边缘，信息不一致或损坏不显示', () => {
  const run = nativeUI(); run.ui.setEnabled(run.addon, true);
  for (const winRect of ['{{-100, 80}, {250, 120}}', '{{820, 550}, {350, 70}}']) {
    run.select(run.card(), winRect); const frame = run.addon.__daguanyuanMasteryToolbar.frame;
    assert.ok(frame.x >= 8 && frame.x + frame.width <= 892);
    assert.ok(frame.y >= 8 && frame.y + frame.height <= 592);
  }
  const card = run.card(); card.comments[1].text = card.comments[1].text.replace('QUESTION_ID:1214', 'QUESTION_ID:9');
  run.select(card); assert.equal(run.addon.__daguanyuanMasteryToolbar.hidden, true);
  run.select(run.card(), 'broken'); assert.equal(run.addon.__daguanyuanMasteryToolbar.hidden, true);
});
test('题卡工具分组保留掌握标记、自动折叠和题卡管理入口，缺少 MN Utils 提示', () => {
  const run = nativeUI(), controller = { addon: run.addon, settingsPage: new run.View({ width: 900, height: 600 }), questionToolsSettingsSection: new run.View({ width: 860, height: 406 }) };
  const settings = run.context.__DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__, repair = run.context.__DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__;
  settings.setup(controller); settings.layout(controller, 860); repair.layout(controller, 860);
  assert.equal(controller.cardToolsTitle.text, '题卡工具'); assert.equal(controller.masteryTitle.text, '掌握标记');
  assert.equal(controller.cardManagementTitle.superview, controller.cardToolsSettingsSection);
  assert.equal(controller.masterySwitch.on, false);
  assert.ok(controller.cardManagementButton.frame.y + controller.cardManagementButton.frame.height <= controller.cardToolsSettingsSection.frame.height);
  controller.masterySwitch.on = true; settings.toggle(controller); assert.equal(run.ui.enabled(), true);
  run.ui.unregister(run.addon); delete run.context.MNUtil; run.ui.setEnabled(run.addon, false);
  controller.masterySwitch.on = true; settings.toggle(controller);
  assert.equal(controller.masterySwitch.on, false); assert.match(run.messages.at(-1), /MN Utils/);
});

test('原生同步桥校验回执、失败和取消，所有路径释放任务', async () => {
  for (const mode of ['success', 'error', 'mismatch', 'cancel']) {
    const scripts = [], timers = [];
    const addon = { panelController: { webView: {} } };
    const context = { console, __DAGUANYUAN_MASTERY_PAGE_SCRIPT__: '/*browser script*/',
      NSTimer: { scheduledTimerWithTimeInterval(t, repeat, callback) { timers.push(callback); } },
      __DAGUANYUAN_IMPORT_SELECTION_GLOBAL__: { evaluate: async (controller, script) => {
        scripts.push(script);
        if (script.includes('.read(')) {
          if (mode === 'cancel') return JSON.stringify({ status: 'loading' });
          return JSON.stringify(mode === 'error' ? { status: 'error', error: '网站错误 429' } : { status: 'ready', id: mode === 'mismatch' ? 2 : 1, mastery: 'mastered' });
        }
        return 'ok';
      } }
    };
    vm.runInNewContext(read('src/DaguanyuanMasterySync.js'), context);
    const sync = context.__DAGUANYUAN_MASTERY_SYNC_GLOBAL__, promise = sync.save(addon, { questionId: 1 }, 'mastered');
    const verified = mode === 'success' ? promise.then(result => assert.equal(result.mastery, 'mastered')) : assert.rejects(promise, /429|不一致|停止/);
    if (mode === 'cancel') { await tick(); sync.cancel(addon); timers.shift()(); }
    await verified; assert.equal(addon.__daguanyuanMasteryTask, null); assert.ok(scripts.some(script => script.includes('.release(')));
    assert.doesNotMatch(scripts.join('\n'), /Bearer|csrf_token|daguan_token/);
  }
});
