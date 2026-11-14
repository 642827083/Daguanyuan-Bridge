import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const coreSource = readFileSync(new URL("../src/DaguanyuanFocusNextCore.js", import.meta.url), "utf8");
const uiSource = readFileSync(new URL("../src/DaguanyuanFocusNextUI.js", import.meta.url), "utf8");
const addonSource = readFileSync(new URL("../src/WebAddon.js", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const icon = readFileSync(new URL("../src/icon.png", import.meta.url));

function runtime(studyController, defaults = {}) {
  const context = {
    Application: { sharedInstance() { return { studyController() { return studyController; } }; } },
    NSUserDefaults: { standardUserDefaults() { return {
      objectForKey(key) { return defaults[key]; },
      setObjectForKey(value, key) { defaults[key] = value; },
    }; } },
    Number, String, Array, Object, console,
  };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  return context.__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__;
}

function notes() {
  const one = { noteId: "1", noteTitle: "一" };
  const two = { noteId: "2", noteTitle: "二" };
  const three = { noteId: "3", noteTitle: "三" };
  const parent = { noteId: "p", noteTitle: "父", childNotes: [one, two, three] };
  one.parentNote = parent;
  two.parentNote = parent;
  three.parentNote = parent;
  return { one, two, three };
}

function navigationRuntime(initialCategoryEnabled = false, initialQuestionLocatorEnabled = false, measuredWidth) {
  let categoryEnabled = initialCategoryEnabled;
  let questionLocatorEnabled = initialQuestionLocatorEnabled;
  const first = { noteId: "first" };
  const second = { noteId: "second" };
  const third = { noteId: "third" };
  const parent = { noteId: "parent", noteTitle: "函数性质", childNotes: [first, second, third] };
  first.parentNote = parent;
  second.parentNote = parent;
  third.parentNote = parent;
  let focusedNote = second;
  const defaults = {};
  const timers = [];
  let view = {
    bounds: { width: 800, height: 600 },
    addSubview(button) { button.superview = this; },
  };
  function UIButton(frame) {
    this.frame = frame;
    this.layer = {};
    this.titleLabel = measuredWidth === undefined ? {} : { sizeThatFits() { return { width: measuredWidth }; } };
    this.setTitleForState = function (title) { this.title = title; };
    this.setTitleColorForState = function () {};
    this.addTargetActionForControlEvents = function (target, action) { this.action = action; };
    this.addGestureRecognizer = function (recognizer) { this.panAction = recognizer.action; };
    this.removeFromSuperview = function () { this.superview = null; };
  }
  const studyController = { get view() { return view; }, notebookController: { notebookId: 'book-1', focusNote: focusedNote } };
  const context = {
    Application: { sharedInstance() { return { studyController() { return studyController; } }; } },
    NSUserDefaults: { standardUserDefaults() { return {
      objectForKey(key) { return defaults[key]; },
      setObjectForKey(value, key) { defaults[key] = value; },
    }; } },
    NSTimer: { scheduledTimerWithTimeInterval(delay, repeats, callback) { timers.push(callback); } },
    UIButton,
    UIPanGestureRecognizer: function (target, action) { this.action = action; },
    UIColor: {
      whiteColor() { return "white"; },
      colorWithRedGreenBlueAlpha() { return "blue"; },
    },
    UIFont: { boldSystemFontOfSize() { return "font"; } },
    __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__: {
      categoryEnabled() { return categoryEnabled; },
      questionLocatorEnabled() { return questionLocatorEnabled; },
      rememberFocus(addon) {
        if (focusedNote && addon) addon.__daguanyuanFocusNextLastFocus = focusedNote;
        return focusedNote;
      },
      siblingProgress(note) {
        const index = parent.childNotes.indexOf(note);
        return index < 0 ? undefined : { index: index + 1, total: parent.childNotes.length };
      },
      parentTitle(note) {
        return note && note.parentNote && note.parentNote.noteTitle || "无题型分类";
      },
    },
    Number, String, Array, Object, JSON, Math, console,
  };
  vm.createContext(context);
  vm.runInContext(uiSource, context);
  return {
    addon: { window: {} },
    defaults,
    timers,
    context,
    studyController,
    ui: context.__DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__,
    setCategoryEnabled(value) { categoryEnabled = value; },
    setQuestionLocatorEnabled(value) { questionLocatorEnabled = value; },
    setFocusedNote(value) { focusedNote = value; studyController.notebookController.focusNote = value; },
    setView(value) { view = value; },
    notes: { first, second, third },
  };
}

test("同级进度按当前卡片在直属父节点中的位置计算", () => {
  const { one, two, three } = notes();
  const core = runtime({ notebookController: {} });
  assert.equal(core.siblingProgress(one).index, 1);
  assert.equal(core.siblingProgress(two).index, 2);
  assert.equal(core.siblingProgress(three).index, 3);
  assert.equal(core.siblingProgress(two).total, 3);
  assert.equal(core.siblingProgress({ noteId: "root" }), undefined);
});

test("题型分类读取当前卡片的直属父节点标题", () => {
  const { one } = notes();
  const core = runtime({ notebookController: {} });
  assert.equal(core.parentTitle(one), "父");
  assert.equal(core.parentTitle({ noteId: "root" }), "无题型分类");
});



test("当前题型绑定源包含学习集和直属父节点 ID", () => {
  const { one } = notes();
  const notebookController = { notebookId: "notebook-1", focusNote: one };
  const core = runtime({ notebookController });
  const source = core.currentCategorySource({ window: {} });
  assert.equal(source.notebookId, "notebook-1");
  assert.equal(source.parentNoteId, "p");
  assert.equal(source.parentTitle, "父");
  assert.deepEqual(Array.from(source.sourcePath), ["父"]);
  const context = core.currentQuestionContext({ window: {} });
  assert.equal(context.source.parentNoteId, "p");
  assert.equal(context.progress.index, 1);
  assert.equal(context.progress.total, 3);
});

test("插件生命周期接入独立题型导航并在断开时清理", () => {
  assert.match(mainSource, /JSB\.require\("DaguanyuanFocusNextCore"\)/);
  assert.match(mainSource, /JSB\.require\("DaguanyuanFocusNextUI"\)/);
  assert.ok(mainSource.indexOf('JSB.require("DaguanyuanFocusNextCore")') < mainSource.indexOf('JSB.require("WebAddon")'));
  assert.match(addonSource, /__DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__\.show\(self\)/);
  assert.match(addonSource, /__DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__\.remove\(self\)/);
  assert.doesNotMatch(addonSource, /toggleFocusNavigation: function/);
});

test("大观园面板仅保留题型工具和题目工具设置", () => {
  assert.match(panelSource, /controller\.settingsButton = button\("设置", controller, "openSettings:"\)/);
  assert.match(panelSource, /controller\.settingsPage = new UIScrollView/);
  assert.match(panelSource, /controller\.questionToolsSettingsSection = new UIView/);
  assert.match(panelSource, /controller\.categoryTitle = label\("显示题型分类"/);
  assert.match(panelSource, /controller\.categorySwitch\.addTargetActionForControlEvents\(controller, "toggleCategoryDisplay:"/);
  assert.match(panelSource, /toggleCategoryDisplay: function/);
  assert.match(panelSource, /controller\.categorySettingsSection = new UIView/);
  assert.match(panelSource, /controller\.categorySectionTitle = label\("题型工具"/);
  assert.match(panelSource, /controller\.categoryJumpTitle = label\("题型分类快捷跳转"/);
  assert.match(panelSource, /controller\.questionToolsTitle = label\("题目工具"/);
  assert.match(panelSource, /controller\.questionLocatorTitle = label\("显示定位题目"/);
  assert.match(panelSource, /controller\.questionLocatorSwitch = new UISwitch/);
  assert.match(panelSource, /toggleQuestionLocator: function/);
  assert.doesNotMatch(panelSource, /focusToggleButton|focus-next-icon\.png|loadFocusToggleIcon/);
  assert.doesNotMatch(panelSource, /controller\.focusSwitch/);
  assert.doesNotMatch(panelSource, /openQuestion|打开选中题目|题目操作/);
  assert.equal((addonSource.match(/queryAddonCommandStatus:/g) || []).length, 1);
  assert.match(addonSource, /selector: "togglePanel:"/);
});

test("题型分类按钮默认关闭，开启后显示直属父节点并保存独立位置", () => {
  const runtime = navigationRuntime();
  runtime.ui.show(runtime.addon);
  assert.equal(runtime.addon.__daguanyuanFocusCategoryButton, undefined);

  runtime.setCategoryEnabled(true);
  runtime.ui.show(runtime.addon);
  const button = runtime.addon.__daguanyuanFocusCategoryButton;
  assert.equal(button.title, "函数性质");
  assert.equal(button.frame.width, 84);
  assert.equal(button.action, "openFocusCategory:");
  assert.equal(button.panAction, "handleFocusCategoryButtonPan:");

  runtime.setFocusedNote(undefined);
  runtime.ui.refreshCategory(runtime.addon, undefined);
  assert.equal(button.title, "函数性质");
  runtime.ui.refreshCategory(runtime.addon, { noteId: "root" });
  assert.equal(button.title, "无题型分类");
  assert.equal(button.frame.width, 98);

  const recognizer = {
    state: 1,
    translationInView() { return { x: 12, y: -8 }; },
    setTranslationInView() {},
  };
  runtime.ui.handleCategoryPan(runtime.addon, recognizer);
  recognizer.state = 2;
  runtime.ui.handleCategoryPan(runtime.addon, recognizer);
  recognizer.state = 3;
  runtime.ui.handleCategoryPan(runtime.addon, recognizer);
  assert.match(runtime.defaults["cn.marginnote.daguanyuan-bridge.focus-next.category-button-position"], /xRatio/);
  assert.equal(runtime.addon.__daguanyuanFocusNextSuppressTap, undefined);

  runtime.setCategoryEnabled(false);
  runtime.ui.show(runtime.addon);
  assert.equal(button.hidden, true);
  assert.equal(button.superview, null);
});

test("定位题目按钮由独立开关控制并保存位置", () => {
  const runtime = navigationRuntime(false, false, 120);
  runtime.ui.syncQuestionLocator(runtime.addon);
  assert.equal(runtime.addon.__daguanyuanQuestionLocatorButton, undefined);

  runtime.setQuestionLocatorEnabled(true);
  runtime.ui.syncQuestionLocator(runtime.addon);
  const button = runtime.addon.__daguanyuanQuestionLocatorButton;
  assert.equal(button.title, "定位题目");
  assert.equal(button.frame.width, 76);
  assert.equal(button.action, "locateQuestion:");
  assert.equal(button.panAction, "handleQuestionLocatorButtonPan:");

  const recognizer = {
    state: 1,
    translationInView() { return { x: -10, y: 9 }; },
    setTranslationInView() {},
  };
  runtime.ui.handleQuestionLocatorPan(runtime.addon, recognizer);
  recognizer.state = 2;
  runtime.ui.handleQuestionLocatorPan(runtime.addon, recognizer);
  recognizer.state = 3;
  runtime.ui.handleQuestionLocatorPan(runtime.addon, recognizer);
  assert.match(runtime.defaults["cn.marginnote.daguanyuan-bridge.question-navigation.locator-button-position"], /xRatio/);
  assert.equal(runtime.addon.__daguanyuanQuestionLocatorSuppressTap, true);

  runtime.setQuestionLocatorEnabled(false);
  runtime.ui.syncQuestionLocator(runtime.addon);
  assert.equal(button.hidden, true);
  assert.equal(button.superview, null);
});

test("插件完整移除打开题目按钮和选题流程", () => {
  const combined = coreSource + uiSource + addonSource + panelSource + mainSource;
  assert.doesNotMatch(combined, /openSelectedQuestion|openQuestionEnabled|__daguanyuanOpenQuestionButton|open-selected-question/);
  assert.doesNotMatch(mainSource, /DaguanyuanSelection|DaguanyuanStorage/);
});

test("插件图标使用带透明通道的 48 像素 PNG", () => {
  assert.equal(icon.toString("ascii", 1, 4), "PNG");
  assert.equal(icon.readUInt32BE(16), 48);
  assert.equal(icon.readUInt32BE(20), 48);
  assert.equal(icon[25], 6);
});

test("插件入口传递包根路径供本地收款图使用，不恢复旧导入页路径", () => {
  assert.match(mainSource, /JSB\.newAddon = function \(mainPath\)/);
  assert.match(mainSource, /createDaguanyuanBridgeAddon\(mainPath\)/);
  assert.match(addonSource, /createController\(self\)/);
  assert.match(addonSource, /__daguanyuanAddonPath = String\(mainPath/);
  assert.doesNotMatch(mainSource + addonSource + panelSource, /focus-next-icon\.png/);
});

test('完整移除前后切换、跨层级遍历及对应设置和配置读写', () => {
  const combined = coreSource + uiSource + addonSource + panelSource;
  assert.doesNotMatch(combined, /焦点切换|显示做题进度|显示上一张|跨层级切换|focusSettingsSection|focusNavigationEnabled/);
  assert.doesNotMatch(combined, /function (?:focusSibling|focusNext|focusPrevious|depthFirstNext|depthFirstPrevious)|toggle(?:FocusNavigation|CrossLevelNavigation|ProgressDisplay|PreviousButton)/);
  assert.doesNotMatch(combined, /focus-next\.(?:enabled|previous-enabled|progress-enabled|cross-level-enabled|next-button-position|previous-button-position)/);
  const core = runtime({ notebookController: {} });
  for (const name of ['focusNext','focusPrevious','enabled','previousEnabled','progressEnabled','crossLevelEnabled']) assert.equal(core[name], undefined);
});

test('旧焦点总开关已关闭也不影响题型和定位按钮，且不再创建上一张下一张', () => {
  const run = navigationRuntime(true, true);
  run.addon.focusNavigationEnabled = false;
  run.defaults['cn.marginnote.daguanyuan-bridge.focus-next.enabled'] = false;
  run.ui.show(run.addon); run.ui.syncQuestionLocator(run.addon);
  assert.ok(run.addon.__daguanyuanFocusCategoryButton.superview);
  assert.ok(run.addon.__daguanyuanQuestionLocatorButton.superview);
  assert.equal(run.addon.__daguanyuanFocusPreviousButton, undefined);
  assert.equal(run.addon.__daguanyuanFocusNextButton, undefined);
});

test('仅开启定位题目时持续记住当前卡片，关闭后停止记录', () => {
  const run = navigationRuntime(false, true);
  run.ui.syncQuestionLocator(run.addon);
  assert.equal(run.addon.__daguanyuanFocusNextLastFocus, run.notes.second);
  run.setFocusedNote(run.notes.third);
  const tick = () => { const callbacks=run.timers.splice(0); callbacks.forEach(fn => fn()); };
  tick();
  assert.equal(run.addon.__daguanyuanFocusNextLastFocus, run.notes.third);
  run.setQuestionLocatorEnabled(false); run.ui.syncQuestionLocator(run.addon);
  run.setFocusedNote(run.notes.first); tick(); tick();
  assert.equal(run.addon.__daguanyuanFocusNextLastFocus, run.notes.third);
  assert.equal(run.timers.length, 0);
});

test('题型和定位开关独立，清理后移除按钮并停止所有记录任务', () => {
  const run = navigationRuntime(true, true);
  run.ui.show(run.addon); run.ui.syncQuestionLocator(run.addon);
  const category = run.addon.__daguanyuanFocusCategoryButton;
  const locator = run.addon.__daguanyuanQuestionLocatorButton;
  run.setCategoryEnabled(false); run.ui.show(run.addon);
  assert.equal(category.superview, null); assert.ok(locator.superview);
  run.ui.remove(run.addon);
  assert.equal(locator.superview, null);
  run.setFocusedNote(run.notes.first);
  run.timers.splice(0).forEach(fn => fn());
  assert.equal(run.timers.length, 0);
  assert.equal(run.addon.__daguanyuanFocusNextLastFocus, run.notes.second);
});

function switchingRuntime(category = true, locator = false) {
  const run = navigationRuntime(category, locator);
  vm.runInContext(coreSource, run.context);
  run.core = run.context.__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__;
  run.core.setCategoryEnabled(category);
  run.core.setQuestionLocatorEnabled(locator);
  run.tick = () => run.timers.splice(0).forEach(callback => callback());
  run.newView = () => ({ bounds: { width: 800, height: 600 }, addSubview(button) { button.superview = this; } });
  run.select = (id, title) => {
    const note = { noteId: id, parentNote: { noteId: id + '-parent', noteTitle: title } };
    run.setFocusedNote(note); return note;
  };
  run.context.JSB = { defineClass(name, methods) { return methods; } };
  run.context.__DAGUANYUAN_WEB_PANEL_GLOBAL__ = { shouldRestorePanel() { return false; } };
  run.addon.panelController = {};
  run.context.self = run.addon;
  vm.runInContext(addonSource, run.context);
  run.lifecycle = run.context.createDaguanyuanBridgeAddon('');
  return run;
}

for (const locator of [false, true]) {
  test('切换脑图时按钮暂时脱离界面后，自动恢复父卡片名称和选卡跟随，定位开关=' + locator, () => {
    const run = switchingRuntime(true, locator);
    run.lifecycle.notebookWillOpen();
    const category = run.addon.__daguanyuanFocusCategoryButton;
    const locatorButton = run.addon.__daguanyuanQuestionLocatorButton;
    assert.equal(category.title, '函数性质');
    category.removeFromSuperview(); locatorButton?.removeFromSuperview();
    run.setView(undefined); run.setFocusedNote(undefined);
    for (let index = 0; index < 4; index += 1) run.tick();
    const newView = run.newView(); run.setView(newView);
    const note = run.select('new-map-card', '矩阵秩');
    run.tick();
    assert.equal(category.title, '矩阵秩');
    assert.equal(category.superview, newView);
    assert.equal(run.addon.__daguanyuanFocusNextLastFocus, note);
    if (locator) assert.equal(locatorButton.superview, newView);
    for (const title of ['特征值', '二重积分', '函数性质']) {
      const nextView = run.newView(); run.setView(nextView); run.select(title, title);
      run.tick();
      assert.equal(category.title, title);
      assert.equal(category.superview, nextView);
      if (locator) assert.equal(locatorButton.superview, nextView);
    }
    assert.equal(run.timers.length, 1);
  });
}

test('打开脑图时学习界面尚未就绪，也能在就绪后显示并更新分类和定位按钮', () => {
  const run = switchingRuntime(true, true);
  run.setView(undefined); run.setFocusedNote(undefined);
  run.lifecycle.notebookWillOpen();
  for (let index = 0; index < 4; index += 1) run.tick();
  const view = run.newView(); run.setView(view); run.select('ready', '伴随矩阵'); run.tick();
  assert.equal(run.addon.__daguanyuanFocusCategoryButton?.title, '伴随矩阵');
  assert.equal(run.addon.__daguanyuanFocusCategoryButton?.superview, view);
  assert.equal(run.addon.__daguanyuanQuestionLocatorButton?.superview, view);
  run.select('next', '矩阵相似'); run.tick();
  assert.equal(run.addon.__daguanyuanFocusCategoryButton.title, '矩阵相似');
});

test('切换中关闭分类开关后不会自动重现，重新开启后只保留一个刷新任务', () => {
  const run = switchingRuntime(); run.lifecycle.notebookWillOpen();
  const button = run.addon.__daguanyuanFocusCategoryButton;
  button.removeFromSuperview(); run.setView(undefined); run.tick();
  run.core.setCategoryEnabled(false); run.ui.show(run.addon);
  run.setView(run.newView()); run.select('disabled', '不应出现');
  for (let index = 0; index < 4; index += 1) run.tick();
  assert.equal(button.superview, null); assert.equal(button.hidden, true); assert.equal(run.timers.length, 0);
  run.core.setCategoryEnabled(true); run.ui.show(run.addon);
  for (let index = 0; index < 4; index += 1) run.tick();
  assert.equal(button.title, '不应出现'); assert.ok(button.superview); assert.equal(run.timers.length, 1);
});

for (const close of ['notebookWillClose', 'sceneDidDisconnect']) {
  test('脑图切换过程中调用 ' + close + ' 后，旧刷新任务不会重新挂载按钮', () => {
    const run = switchingRuntime(true, true); run.lifecycle.notebookWillOpen();
    const category = run.addon.__daguanyuanFocusCategoryButton, locator = run.addon.__daguanyuanQuestionLocatorButton;
    category.removeFromSuperview(); locator.removeFromSuperview(); run.setView(undefined); run.tick();
    run.lifecycle[close]();
    run.setView(run.newView()); run.select('closed', '已关闭');
    for (let index = 0; index < 4; index += 1) run.tick();
    assert.equal(category.superview, null); assert.equal(locator.superview, null); assert.equal(run.timers.length, 0);
    if (close === 'notebookWillClose') {
      assert.equal(run.addon.__daguanyuanFocusNextLastFocus, null);
      run.lifecycle.notebookWillOpen();
      assert.equal(category.title, '已关闭'); assert.ok(category.superview);
    }
  });
}

test('脑图切换时原生按钮暂时无法更新，下一轮仍能恢复选卡跟随', () => {
  const run = switchingRuntime(); run.lifecycle.notebookWillOpen();
  const button = run.addon.__daguanyuanFocusCategoryButton, setTitle = button.setTitleForState;
  let failed = false;
  button.setTitleForState = function (title, state) {
    if (!failed) { failed = true; throw Error('切换中按钮暂不可用'); }
    return setTitle.call(this, title, state);
  };
  run.select('recovered', '矩阵的秩');
  assert.doesNotThrow(() => run.tick());
  run.tick(); assert.equal(button.title, '矩阵的秩');
});

test('仅开启定位题目时，切换脑图也会恢复选卡记录，不创建分类按钮', () => {
  const run = switchingRuntime(false, true); run.lifecycle.notebookWillOpen();
  const button = run.addon.__daguanyuanQuestionLocatorButton;
  button.removeFromSuperview(); run.setView(undefined); run.tick();
  const view = run.newView(); run.setView(view); const note = run.select('locator-map', '线性方程组');
  run.tick();
  assert.equal(button.superview, view); assert.equal(run.addon.__daguanyuanFocusNextLastFocus, note);
  assert.equal(run.addon.__daguanyuanFocusCategoryButton, undefined);
});

test('本窗口脑图尚未就绪时，不把分类按钮挂到另一窗口', () => {
  const run = switchingRuntime(); run.lifecycle.notebookWillOpen();
  const button = run.addon.__daguanyuanFocusCategoryButton, otherView = run.newView();
  run.context.Application.sharedInstance = () => ({ focusWindow: {}, studyController(window) {
    return window === run.addon.window ? run.studyController : { view: otherView };
  } });
  button.removeFromSuperview(); run.setView(undefined); run.setFocusedNote(undefined);
  for (let index = 0; index < 4; index += 1) run.tick();
  assert.equal(button.superview, null);
  const ownView = run.newView(); run.setView(ownView); run.select('own-map', '本窗口分类'); run.tick();
  assert.equal(button.superview, ownView); assert.equal(button.title, '本窗口分类');
});

test('分类诊断可区分按钮保留但刷新已停止，并且采样不重启任务或改变选卡', () => {
  const run = switchingRuntime(), entries = [];
  let now = 10000;
  run.context.Date = { now: () => now };
  run.context.__DAGUANYUAN_DIAGNOSTICS_GLOBAL__ = { info: (event, details) => entries.push({ event, details }), flush() {} };
  run.lifecycle.notebookWillOpen('book-1');
  const button = run.addon.__daguanyuanFocusCategoryButton;
  run.timers.length = 0;
  now += 6000;
  run.studyController.notebookController.notebookId = 'private-book-2';
  const selected = run.select('private-new-note', '不应写入日志的卡片名称');
  selected.notebookId = 'private-book-2';
  const remembered = run.addon.__daguanyuanFocusNextLastFocus;
  run.ui.diagnose(run.addon, 'copy_logs');
  const sample = entries.at(-1);
  assert.equal(sample.event, 'focus.trace');
  assert.equal(sample.details.stage, 'copy_logs');
  assert.equal(sample.details.heartbeatAgeMs, 6000);
  assert.equal(sample.details.categoryState, 'attached');
  assert.equal(sample.details.notebookMatchesOpening, 'mismatch');
  assert.equal(sample.details.focusInNotebook, 'match');
  assert.equal(sample.details.focusMatchesMemory, 'mismatch');
  assert.equal(sample.details.categoryMatchesFocus, 'mismatch');
  assert.equal(run.addon.__daguanyuanFocusNextLastFocus, remembered);
  assert.equal(button.title, '函数性质'); assert.equal(run.timers.length, 0);
  assert.doesNotMatch(JSON.stringify(entries), /private-book-2|private-new-note|不应写入日志的卡片名称|函数性质/);
});

test('学习集打开初始化中途失败时，诊断记录具体阶段并保留原来的异常行为', () => {
  const run = switchingRuntime(), entries = [], errors = [];
  run.context.__DAGUANYUAN_DIAGNOSTICS_GLOBAL__ = { info: (event, details) => entries.push({ event, details }),
    error: (event, failure, details) => errors.push({ event, failure, details }) };
  run.context.__DAGUANYUAN_MASTERY_UI_GLOBAL__ = { hide() {}, register() { throw Error('原生注册失败'); } };
  assert.throws(() => run.lifecycle.notebookWillOpen('book-2'), /原生注册失败/);
  assert.ok(entries.some(row => row.details.stage === 'notebook_open_enter'));
  assert.equal(errors[0].event, 'focus.notebook.open.failure');
  assert.equal(errors[0].details.stage, 'register_card_tools');
  assert.equal(entries.some(row => row.details.stage === 'notebook_open_complete'), false);
});

test('正常选卡刷新只在状态变化或每五秒记录诊断，关闭事件也有停止状态', () => {
  const run = switchingRuntime(), entries = [];
  let now = 10000;
  run.context.Date = { now: () => now };
  run.context.__DAGUANYUAN_DIAGNOSTICS_GLOBAL__ = { info: (event, details) => entries.push({ event, details }), flush() {} };
  run.lifecycle.notebookWillOpen('book-1');
  for (let index = 0; index < 50; index += 1) { now += 150; run.tick(); }
  const samples = entries.filter(row => row.details.stage === 'loop_sample');
  assert.ok(samples.length >= 1 && samples.length <= 3);
  assert.ok(samples.at(-1).details.tickCount >= 30);
  run.lifecycle.notebookWillClose('book-1');
  assert.ok(entries.some(row => row.details.stage === 'notebook_close_enter'));
  assert.equal(entries.filter(row => row.event === 'focus.trace').at(-1).details.categoryState, 'hidden');
});

for (const mode of ['category', 'locator', 'both']) {
  test('回放真机日志：学习集切换期间按钮暂时隐藏，恢复可见后仍持续更新，模式=' + mode, () => {
    const run = switchingRuntime(mode !== 'locator', mode !== 'category');
    const trace = [];
    let now = 10000;
    run.context.Date = { now: () => now };
    run.context.__DAGUANYUAN_DIAGNOSTICS_GLOBAL__ = { info: (event, details) => trace.push({ event, details }), flush() {} };
    run.lifecycle.notebookWillOpen('book-1');
    const buttons = [run.addon.__daguanyuanFocusCategoryButton, run.addon.__daguanyuanQuestionLocatorButton].filter(Boolean);
    const category = run.addon.__daguanyuanFocusCategoryButton;
    run.lifecycle.notebookWillClose('book-1');
    // 真机日志中，打开新学习集后按钮仍短暂报告隐藏，稍后恢复可见，但刷新已退出。
    let hostHiding = true;
    for (const button of buttons) {
      let requestedHidden = button.hidden;
      Object.defineProperty(button, 'hidden', { configurable: true,
        get() { return hostHiding || requestedHidden; }, set(value) { requestedHidden = value; } });
    }
    run.studyController.notebookController.notebookId = 'book-2';
    run.setView(run.newView()); run.setFocusedNote(undefined);
    run.lifecycle.notebookWillOpen('book-2');
    const ticksAtOpen = run.addon.__daguanyuanFocusNextTickCount;
    for (let index = 0; index < 4; index += 1) { now += 150; run.tick(); }
    hostHiding = false;
    const note = run.select('book-2-first', '新学习集分类'); note.notebookId = 'book-2';
    for (let index = 0; index < 120; index += 1) { now += 150; run.tick(); }
    run.ui.diagnose(run.addon, 'export_logs');
    assert.equal(buttons.every(button => !button.hidden && button.superview === run.studyController.view), true);
    assert.equal(run.addon.__daguanyuanFocusNextLastFocus, note);
    if (category) assert.equal(category.title, '新学习集分类');
    assert.ok(run.addon.__daguanyuanFocusNextTickCount > ticksAtOpen);
    assert.ok(trace.at(-1).details.heartbeatAgeMs < 200);
    assert.equal(run.timers.length, 1);
    run.lifecycle.notebookWillClose('book-2');
    for (let index = 0; index < 5; index += 1) run.tick();
    assert.equal(run.timers.length, 0);
    assert.equal(buttons.every(button => button.hidden && !button.superview), true);
  });
}

test('原生视图每次返回不同 JS 包装时，使用原生子视图归属避免重复拆装按钮', () => {
  const run = switchingRuntime(true, true), memberships = [];
  function nativeView() {
    const children = new Set(); memberships.push(children);
    return { bounds: { width: 800, height: 600 }, adds: 0,
      get subviews() { return { containsObject: button => children.has(button) }; },
      addSubview(button) {
        this.adds += 1; children.add(button);
        Object.defineProperty(button, 'superview', { configurable: true, get: () => children.has(button) ? {} : null });
        button.removeFromSuperview = () => memberships.forEach(set => set.delete(button));
      } };
  }
  const firstView = nativeView(); run.setView(firstView); run.lifecycle.notebookWillOpen('book-1');
  const before = firstView.adds;
  for (let index = 0; index < 10; index += 1) run.tick();
  assert.equal(firstView.adds, before);
  const nextView = nativeView(); run.setView(nextView); run.select('next-view', '正确的新分类');
  for (let index = 0; index < 10; index += 1) run.tick();
  assert.equal(nextView.adds, 2);
  assert.equal(run.addon.__daguanyuanFocusCategoryButton.title, '正确的新分类');
  assert.equal(firstView.subviews.containsObject(run.addon.__daguanyuanFocusCategoryButton), false);
  const trace = [];
  run.context.__DAGUANYUAN_DIAGNOSTICS_GLOBAL__ = { info: (event, details) => trace.push(details) };
  run.ui.diagnose(run.addon, 'export_logs');
  assert.equal(trace.at(-1).categoryState, 'attached'); assert.equal(trace.at(-1).locatorState, 'attached');
});
