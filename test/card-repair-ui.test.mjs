import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const tick = () => new Promise(resolve => setImmediate(resolve));
function runtime(width = 560, height = 420) {
  const messages = [], applied = [], cancelled = [], color = { colorWithAlphaComponent() { return this; } };
  class View {
    constructor(frame) { this.frame = frame; this.layer = {}; this.subviews = []; this.titleLabel = {}; }
    get bounds() { return { x: 0, y: 0, width: this.frame.width, height: this.frame.height }; }
    addSubview(view) { this.subviews.push(view); view.parent = this; }
    removeFromSuperview() { this.parent.subviews = this.parent.subviews.filter(v => v !== this); }
    setTitleForState(title) { this.title = title; } setTitleColorForState() {}
    addTargetActionForControlEvents(target, action, event) { this.target = target; this.action = action; assert.equal(event, 1); }
  }
  const prepared = { questionCount: 2, answerCount: 1, jobs: [{}, {}, {}], skipped: [] };
  const controller = { activePage: 'settings', addon: { window: {} }, containerView: new View({ x: 0, y: 0, width, height }),
    repairCardsDescription: new View({}),
    questionToolsSettingsSection: new View({ x: 20, y: 920, width: width - 40, height: 484 }) };
  const context = { console, UIView: View, UILabel: View, UIButton: View, UIScrollView: View,
    UIFont: { systemFontOfSize: String, boldSystemFontOfSize: String },
    UIColor: { whiteColor: () => color, grayColor: () => color, darkGrayColor: () => color, lightGrayColor: () => color,
      colorWithWhiteAlpha: () => color, colorWithRedGreenBlueAlpha: () => color },
    Application: { sharedInstance() { return { showHUD(message) { messages.push(message); } }; } },
    __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__: { cancelMode(target) { cancelled.push(target); } },
    __DAGUANYUAN_CARD_REPAIR_GLOBAL__: { preview() { return prepared; }, apply(addon, input) { applied.push(input); return { repairedCount: 3, skippedCount: 0, failed: [] }; } },
  };
  vm.createContext(context); vm.runInContext(readFileSync(new URL('../src/DaguanyuanCardRepairUI.js', import.meta.url), 'utf8'), context);
  const ui = context.__DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__; ui.layout(controller);
  return { controller, context, prepared, messages, applied, cancelled, ui };
}

test('修复入口先统计并显示题目/答案数量，正确确认按钮才修改，重复确认不执行', async () => {
  const run = runtime(), { ui, controller } = run;
  assert.equal(controller.repairCardsButton, undefined);
  ui.repair(controller); assert.equal(run.applied.length, 0); await tick();
  const state = controller.cardRepairState; assert.match(state.message.text, /题目卡 2 张，答案卡 1 张/);
  assert.equal(state.title.text, '修复题卡格式');
  ui.confirm(controller, {}); assert.equal(run.applied.length, 0);
  ui.confirm(controller, state.confirm); assert.equal(run.applied.length, 1); assert.equal(run.applied[0], run.prepared);
  assert.equal(controller.cardRepairState, null); assert.match(run.messages.at(-1), /已修复 3/);
  ui.confirm(controller, state.confirm); assert.equal(run.applied.length, 1);
});

test('取消和切换页面时不执行待完成统计，忙碌期间不开始或确认修复', async () => {
  const run = runtime(), { ui, controller } = run;
  ui.repair(controller); ui.cancel(controller); await tick(); assert.equal(controller.cardRepairState, null); assert.equal(controller.containerView.subviews.length, 0);
  controller.activePage = 'import'; ui.repair(controller); await tick(); assert.equal(controller.cardRepairState, null);
  controller.activePage = 'settings'; controller.singleImportBusy = true; ui.repair(controller); assert.match(run.messages.at(-1), /稍后修复/);
  controller.singleImportBusy = false; ui.repair(controller); await tick(); const state = controller.cardRepairState;
  controller.importWorkspaceTask = { status: 'running' }; ui.confirm(controller, state.confirm); assert.equal(run.applied.length, 0); assert.equal(controller.cardRepairState, null);
});

test('没有可修复卡片、统计失败或写入失败恢复入口并显示原因', async () => {
  for (const kind of ['empty', 'skipped', 'preview', 'apply']) {
    const run = runtime(), { ui, controller } = run;
    if (kind === 'empty' || kind === 'skipped') run.prepared.jobs = [];
    if (kind === 'skipped') run.prepared.skipped = [{ reason: '身份冲突' }];
    if (kind === 'preview') run.context.__DAGUANYUAN_CARD_REPAIR_GLOBAL__.preview = () => { throw Error('请启用 MN Utils'); };
    if (kind === 'apply') run.context.__DAGUANYUAN_CARD_REPAIR_GLOBAL__.apply = () => { throw Error('学习集已切换'); };
    ui.repair(controller); await tick();
    if (kind === 'apply') ui.confirm(controller, controller.cardRepairState.confirm);
    assert.equal(controller.cardRepairState, null);
    assert.match(run.messages.at(-1), /无需修复|身份冲突|MN Utils|学习集已切换/);
    assert.match(controller.repairCardsDescription.text, /整理题卡格式/);
  }
});

test('不同面板尺寸中修复确认内容可滚动，按钮和设置行在对应容器内', async () => {
  for (const [width, height] of [[560, 420], [960, 680], [1300, 900], [300, 250]]) {
    const { ui, controller } = runtime(width, height); ui.repair(controller); await tick();
    const state = controller.cardRepairState;
    assert.ok(state.sheet.frame.x >= 0); assert.ok(state.sheet.frame.y >= 0);
    assert.ok(state.sheet.frame.x + state.sheet.frame.width <= width); assert.ok(state.sheet.frame.height <= height - 44);
    assert.ok(state.messageScroll.contentSize.height >= state.messageScroll.frame.height);
    assert.ok(state.confirm.frame.y >= state.messageScroll.frame.y + state.messageScroll.frame.height);
  }
});

test('入口模块及面板接通修复设置、确认、取消、关闭和布局', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'), panel = readFileSync(new URL('../src/WebPanelController.js', import.meta.url), 'utf8');
  for (const name of ['DaguanyuanCardComments', 'DaguanyuanCardRepair', 'DaguanyuanCardRepairUI']) assert.ok(main.includes('JSB.require("' + name + '")'));
  for (const selector of ['repairImportedCards:', 'openImportedCardManagement:', 'selectImportedCardManagement:', 'confirmCardRepair:', 'cancelCardRepair:']) assert.ok(panel.includes(selector));
  assert.match(panel, /__DAGUANYUAN_CARD_TOOLS_SETTINGS_GLOBAL__\.openManagement\(self\)/);
  assert.match(panel, /__DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__\.layout\(controller\)/);
  assert.ok(panel.match(/__DAGUANYUAN_CARD_REPAIR_UI_GLOBAL__\.cancel\(controller\)/g).length >= 2);
});
