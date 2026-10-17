import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function runtime() {
  class View {
    constructor(frame) { this.frame = frame; this.children = []; this.layer = {}; this.titleLabel = {}; }
    get bounds() { return this.customBounds || { width: this.frame.width, height: this.frame.height }; }
    set bounds(value) { this.customBounds = value; }
    addSubview(view) { view.superview = this; this.children.push(view); }
    removeFromSuperview() { if (this.superview) this.superview.children = this.superview.children.filter(v => v !== this); this.superview = null; }
    setTitleForState(title) { this.title = title; }
    setTitleColorForState() {}
    addTargetActionForControlEvents(controller, selector) { this.target = controller; this.selector = selector; }
    addGestureRecognizer() {}
    loadRequest() {}
    evaluateJavaScript(script, callback) { callback(true); }
  }
  const context = { console, UIView: View, UIButton: View, UILabel: View, UIScrollView: View,
    UIColor: { whiteColor() { return {}; }, lightGrayColor() { return { colorWithAlphaComponent() { return {}; } }; }, darkGrayColor() { return { colorWithAlphaComponent() { return {}; } }; }, grayColor() { return {}; }, colorWithRedGreenBlueAlpha() { return {}; }, colorWithWhiteAlpha() { return {}; } },
    UIFont: { systemFontOfSize() { return {}; }, boldSystemFontOfSize() { return {}; } },
  };
  vm.createContext(context); vm.runInContext(fs.readFileSync(new URL('../src/DaguanyuanCardLocatorUI.js', import.meta.url), 'utf8'), context);
  return { context, View, controller: { containerView: new View({ width: 800, height: 620 }) }, ui: context.__DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__ };
}
const candidates = Array.from({ length: 12 }, (_, i) => ({ noteId: 'card-' + i, notebookId: 'book-' + i, studySetTitle: '学习集 ' + i, title: '2026年 第44题', path: '408 / 2026 / 章节' }));

test('题卡选择列表显示学习集和路径，可滚动、调整尺寸并选择指定卡片', async () => {
  const { controller, ui } = runtime(); const pending = ui.choose(controller, candidates); const choice = controller.cardLocationChoice;
  assert.equal(controller.containerView.children.length, 1); assert.equal(choice.buttons.length, 12);
  assert.match(choice.buttons[10].title, /学习集 10\n408 \/ 2026 \/ 章节 \/ 2026年 第44题/);
  assert.equal(choice.buttons[10].selector, 'selectCardLocationChoice:'); assert.equal(choice.buttons[10].tag, 10);
  assert.ok(choice.scroll.contentSize.height > choice.scroll.frame.height);
  controller.containerView.bounds = { width: 960, height: 700 }; ui.layout(controller);
  assert.equal(choice.view.frame.width, 936); assert.equal(choice.buttons[0].frame.width, 912);
  ui.select(controller, 10, choice.buttons[10]); assert.equal((await pending).noteId, 'card-10');
  assert.equal(controller.cardLocationChoice, null); assert.equal(controller.containerView.children.length, 0);
});

test('取消、重开选择列表及迟到的旧按钮事件不会跳到错误卡片', async () => {
  const { controller, ui } = runtime();
  const first = ui.choose(controller, candidates); const oldButton = controller.cardLocationChoice.buttons[0];
  const rejected = assert.rejects(first, /取消/); ui.cancel(controller); await rejected;
  const second = ui.choose(controller, candidates); ui.select(controller, 0, oldButton);
  assert.ok(controller.cardLocationChoice); ui.select(controller, -1); assert.ok(controller.cardLocationChoice);
  const currentButton = controller.cardLocationChoice.buttons[1]; ui.select(controller, 1, currentButton);
  assert.equal((await second).noteId, 'card-1'); assert.equal(controller.containerView.children.length, 0);
  await assert.rejects(ui.choose({}, candidates), /选择窗口不可用/);
});

test('定位方式菜单标记当前值，取消不修改，选择返回方式并清理弹层', () => {
  const { controller, ui } = runtime(); const selected = [];
  ui.chooseMode(controller, 'focus', value => selected.push(value));
  let menu = controller.cardLocationModeChoice;
  assert.equal(menu.buttons[1].title, '定位并聚焦（当前）'); assert.equal(menu.buttons[0].title, '仅定位');
  assert.equal(menu.buttons[0].selector, 'selectCardLocationMode:');
  assert.equal(menu.sheet.frame.x + menu.sheet.frame.width / 2, controller.containerView.bounds.width / 2);
  ui.selectMode(controller, 2, menu.buttons[2]); assert.deepEqual(selected, []); assert.equal(controller.containerView.children.length, 0);
  ui.chooseMode(controller, 'focus', value => selected.push(value)); menu = controller.cardLocationModeChoice;
  const oldButton = menu.buttons[0]; ui.cancelMode(controller);
  ui.chooseMode(controller, 'locate', value => selected.push(value)); ui.selectMode(controller, 0, oldButton);
  assert.ok(controller.cardLocationModeChoice); menu = controller.cardLocationModeChoice;
  controller.containerView.bounds = { width: 560, height: 420 }; ui.layout(controller);
  assert.ok(menu.sheet.frame.y + menu.sheet.frame.height <= menu.overlay.frame.height);
  ui.selectMode(controller, 0, menu.buttons[0]); assert.deepEqual(selected, ['locate']);
  assert.equal(controller.cardLocationModeChoice, null); assert.equal(controller.containerView.children.length, 0);
});

test('设置入口位于定位开关下方，保存后即时显示，切页和关闭均清理选择菜单', () => {
  const { context, View, ui } = runtime(); const stored = new Map(); let methods;
  context.UISwitch = View; context.UIWebView = View; context.UIPanGestureRecognizer = View;
  context.UITapGestureRecognizer = class { requireGestureRecognizerToFail() {} };
  context.NSUserDefaults = { standardUserDefaults() { return {
    objectForKey(key) { return stored.get(key); }, setObjectForKey(value, key) { stored.set(key, value); },
  }; } };
  context.JSB = { defineClass(name, value) { methods = value; return {}; } };
  context.NSURL = { URLWithString: v => v }; context.NSURLRequest = { requestWithURL: v => v };
  context.NSTimer = { scheduledTimerWithTimeInterval() { return { invalidate() {} }; } };
  context.Application = { sharedInstance() { return { showHUD() {} }; } };
  context.__DAGUANYUAN_CATEGORY_MANAGER_UI_GLOBAL__ = { setup(controller) { controller.categoryManagerPage = new View({ width: 800, height: 600 }); }, layout() {} };
  context.__DAGUANYUAN_IMPORT_REPORT_GLOBAL__ = { layout() {} };
  for (const name of ['DaguanyuanFocusNextCore', 'DaguanyuanCardLocator', 'DaguanyuanSingleImport', 'DaguanyuanPanelNavigation', 'WebPanelController']) {
    vm.runInContext(fs.readFileSync(new URL(`../src/${name}.js`, import.meta.url), 'utf8'), context);
  }
  const panel = { addon: { window: {} } }; context.self = panel; methods.viewDidLoad(); methods.openSettings();
  assert.equal(panel.cardLocationModeValue.text, '定位并聚焦');
  assert.equal(panel.cardLocationModeTitle.superview, panel.questionToolsSettingsSection);
  assert.ok(panel.cardLocationModeButton.frame.y > panel.websiteLocateSwitch.frame.y + panel.websiteLocateSwitch.frame.height);
  assert.ok(panel.noteAddTitle.frame.y > panel.cardLocationModeButton.frame.y + panel.cardLocationModeButton.frame.height);
  assert.ok(panel.settingsPage.contentSize.height >= panel.questionToolsSettingsSection.frame.y + panel.questionToolsSettingsSection.frame.height);
  assert.equal(panel.singleImportPositionValue.text, '子节点');
  assert.equal(panel.singleImportPositionTitle.superview, panel.questionToolsSettingsSection);
  assert.ok(panel.singleImportPositionButton.frame.y > panel.singleImportSwitch.frame.y + panel.singleImportSwitch.frame.height);
  methods.chooseSingleImportPosition(); let positionMenu = panel.cardLocationModeChoice;
  assert.equal(positionMenu.title.text, '导入本题位置');
  assert.equal(positionMenu.buttons[0].title, '所选卡片的子节点（当前）');
  assert.equal(positionMenu.buttons[1].selector, 'selectSingleImportPosition:');
  methods.selectSingleImportPosition(positionMenu.buttons[1]);
  assert.equal(panel.singleImportPositionValue.text, '同级节点');
  assert.equal(stored.get('cn.marginnote.daguanyuan-bridge.question-tools.single-import-position'), 'sibling');
  methods.chooseSingleImportPosition(); positionMenu = panel.cardLocationModeChoice;
  methods.selectSingleImportPosition(positionMenu.buttons[2]);
  assert.equal(panel.singleImportPositionValue.text, '同级节点');
  methods.chooseCardLocationMode(); let menu = panel.cardLocationModeChoice;
  methods.selectCardLocationMode(menu.buttons[0]); assert.equal(panel.cardLocationModeValue.text, '仅定位');
  assert.equal(stored.get('cn.marginnote.daguanyuan-bridge.question-tools.card-location-mode'), 'locate');
  methods.chooseCardLocationMode(); menu = panel.cardLocationModeChoice; methods.selectCardLocationMode(menu.buttons[2]);
  assert.equal(context.__DAGUANYUAN_CARD_LOCATOR_GLOBAL__.mode(), 'locate');
  methods.chooseCardLocationMode(); methods.openDaguanyuan(); assert.equal(panel.cardLocationModeChoice, null);
  methods.openSettings(); assert.equal(panel.cardLocationModeValue.text, '仅定位');
  assert.equal(panel.singleImportPositionValue.text, '同级节点');
  methods.chooseCardLocationMode(); methods.closePanel(); assert.equal(panel.cardLocationModeChoice, null);
  ui.cancelMode(panel);
});
