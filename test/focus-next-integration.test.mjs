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

function traversalNotes() {
  const root = { noteId: "root", noteTitle: "根" };
  const branchA = { noteId: "a", noteTitle: "分支 A" };
  const branchA1 = { noteId: "a1", noteTitle: "A1" };
  const branchA2 = { noteId: "a2", noteTitle: "A2" };
  const branchB = { noteId: "b", noteTitle: "分支 B" };
  const branchB1 = { noteId: "b1", noteTitle: "B1" };
  const branchB1a = { noteId: "b1a", noteTitle: "B1a" };
  const branchB2 = { noteId: "b2", noteTitle: "B2" };
  root.childNotes = [branchA, branchB];
  branchA.parentNote = root;
  branchB.parentNote = root;
  branchA.childNotes = [branchA1, branchA2];
  branchA1.parentNote = branchA;
  branchA2.parentNote = branchA;
  branchB.childNotes = [branchB1, branchB2];
  branchB1.parentNote = branchB;
  branchB2.parentNote = branchB;
  branchB1.childNotes = [branchB1a];
  branchB1a.parentNote = branchB1;
  return { root, branchA, branchA1, branchA2, branchB, branchB1, branchB1a, branchB2 };
}

function focusButtonsRuntime(initialPreviousEnabled, initialProgressEnabled = false, initialCategoryEnabled = false) {
  let previousEnabled = initialPreviousEnabled;
  let progressEnabled = initialProgressEnabled;
  let categoryEnabled = initialCategoryEnabled;
  const first = { noteId: "first" };
  const second = { noteId: "second" };
  const third = { noteId: "third" };
  const parent = { noteId: "parent", noteTitle: "函数性质", childNotes: [first, second, third] };
  first.parentNote = parent;
  second.parentNote = parent;
  third.parentNote = parent;
  let focusedNote = second;
  const defaults = {};
  const view = {
    bounds: { width: 800, height: 600 },
    addSubview(button) { button.superview = this; },
  };
  function UIButton(frame) {
    this.frame = frame;
    this.layer = {};
    this.titleLabel = {};
    this.setTitleForState = function (title) { this.title = title; };
    this.setTitleColorForState = function () {};
    this.addTargetActionForControlEvents = function (target, action) { this.action = action; };
    this.addGestureRecognizer = function (recognizer) { this.panAction = recognizer.action; };
    this.removeFromSuperview = function () { this.superview = null; };
  }
  const context = {
    Application: { sharedInstance() { return { studyController() { return { view }; } }; } },
    NSUserDefaults: { standardUserDefaults() { return {
      objectForKey(key) { return defaults[key]; },
      setObjectForKey(value, key) { defaults[key] = value; },
    }; } },
    UIButton,
    UIPanGestureRecognizer: function (target, action) { this.action = action; },
    UIColor: {
      whiteColor() { return "white"; },
      colorWithRedGreenBlueAlpha() { return "blue"; },
    },
    UIFont: { boldSystemFontOfSize() { return "font"; } },
    __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__: {
      previousEnabled() { return previousEnabled; },
      progressEnabled() { return progressEnabled; },
      categoryEnabled() { return categoryEnabled; },
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
    ui: context.__DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__,
    setPreviousEnabled(value) { previousEnabled = value; },
    setProgressEnabled(value) { progressEnabled = value; },
    setCategoryEnabled(value) { categoryEnabled = value; },
    setFocusedNote(value) { focusedNote = value; },
    notes: { first, second, third },
  };
}

function panelToggleRuntime(enabled) {
  let methods;
  const calls = [];
  const hud = [];
  const context = {
    JSB: {
      defineClass(name, instanceMethods) {
        methods = instanceMethods;
        return { new() { return {}; } };
      },
    },
    UIColor: {
      colorWithRedGreenBlueAlpha() { return "blue"; },
      colorWithWhiteAlpha() { return "clear"; },
      darkGrayColor() { return "gray"; },
    },
    Application: {
      sharedInstance() {
        return { showHUD(message) { hud.push(String(message)); } };
      },
    },
    NSUserDefaults: {
      standardUserDefaults() {
        return { objectForKey() {}, setObjectForKey() {} };
      },
    },
    __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__: {
      setEnabled(value) {
        calls.push(`set:${value}`);
        return Boolean(value);
      },
      previousEnabled() { return true; },
      progressEnabled() { return false; },
      categoryEnabled() { return false; },
    },
    __DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__: {
      show() { calls.push("show"); },
      hide() { calls.push("hide"); },
    },
    Number, String, Array, Object, Date, JSON, Math, RegExp, Error, console,
  };
  vm.createContext(context);
  vm.runInContext(panelSource, context);
  context.self = {
    addon: { window: {}, focusNavigationEnabled: enabled },
    focusEnabledSwitch: { on: enabled },
  };
  methods.toggleFocusNavigation({});
  return { calls, hud, addon: context.self.addon };
}

test("集成后的焦点导航只在同级卡片间前后切换", () => {
  const { one, two, three } = notes();
  const notebookController = {
    focusNote: two,
    changeFocusToNote(note) { this.focusNote = note; },
  };
  const core = runtime({ notebookController });
  const addon = { window: {} };
  assert.equal(core.focusNext(addon).next, three);
  notebookController.focusNote = two;
  assert.equal(core.focusPrevious(addon).next, one);
  notebookController.focusNote = one;
  assert.throws(() => core.focusPrevious(addon), /第一张同级卡片/);
  notebookController.focusNote = three;
  assert.throws(() => core.focusNext(addon), /最后一张同级卡片/);
});

test("跨层级切换按前序深度优先顺序前进并按严格逆序后退", () => {
  const tree = traversalNotes();
  const defaults = { "cn.marginnote.daguanyuan-bridge.focus-next.cross-level-enabled": true };
  const notebookController = {
    focusNote: tree.branchA2,
    changeFocusToNote(note) { this.focusNote = note; },
  };
  const core = runtime({ notebookController }, defaults);
  const addon = { window: {} };

  assert.equal(core.focusNext(addon).next, tree.branchB);
  assert.equal(core.focusNext(addon).next, tree.branchB1);
  assert.equal(core.focusNext(addon).next, tree.branchB1a);
  assert.equal(core.focusNext(addon).next, tree.branchB2);
  assert.equal(core.focusPrevious(addon).next, tree.branchB1a);

  notebookController.focusNote = tree.branchB;
  addon.__daguanyuanFocusNextLastFocus = tree.branchB;
  assert.equal(core.focusPrevious(addon).next, tree.branchA2);
  notebookController.focusNote = tree.branchA1;
  addon.__daguanyuanFocusNextLastFocus = tree.branchA1;
  assert.equal(core.focusPrevious(addon).next, tree.branchA);
  assert.equal(core.focusPrevious(addon).next, tree.root);
  assert.throws(() => core.focusPrevious(addon), /整棵脑图的第一张卡片/);

  notebookController.focusNote = tree.branchB2;
  addon.__daguanyuanFocusNextLastFocus = tree.branchB2;
  assert.throws(() => core.focusNext(addon), /整棵脑图的最后一张卡片/);
});

test("集成模块使用 Daguanyuan Bridge 独立命名空间和持久化键", () => {
  const defaults = {};
  const core = runtime({ notebookController: {} }, defaults);
  assert.equal(core.enabled(), true);
  assert.equal(core.previousEnabled(), true);
  assert.equal(core.progressEnabled(), false);
  assert.equal(core.categoryEnabled(), false);
  assert.equal(core.crossLevelEnabled(), false);
  core.setEnabled(false);
  core.setPreviousEnabled(false);
  core.setProgressEnabled(true);
  core.setCategoryEnabled(true);
  core.setCrossLevelEnabled(true);
  assert.equal(defaults["cn.marginnote.daguanyuan-bridge.focus-next.enabled"], false);
  assert.equal(defaults["cn.marginnote.daguanyuan-bridge.focus-next.previous-enabled"], false);
  assert.equal(defaults["cn.marginnote.daguanyuan-bridge.focus-next.progress-enabled"], true);
  assert.equal(defaults["cn.marginnote.daguanyuan-bridge.focus-next.category-enabled"], true);
  assert.equal(defaults["cn.marginnote.daguanyuan-bridge.focus-next.cross-level-enabled"], true);
  assert.doesNotMatch(coreSource + uiSource, /__FOCUS_NEXT_/);
  assert.doesNotMatch(coreSource + uiSource, /__focus/);
  assert.match(uiSource, /daguanyuan-bridge\.focus-next\.next-button-position/);
  assert.match(uiSource, /daguanyuan-bridge\.focus-next\.previous-button-position/);
  assert.match(uiSource, /daguanyuan-bridge\.focus-next\.category-button-position/);
  assert.match(uiSource, /previousEnabled\(\)/);
  assert.match(uiSource, /definition\.visible === false/);
  assert.doesNotMatch(coreSource + uiSource, /open-selected-question/);
});

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

test("插件生命周期接入焦点按钮并在断开时清理", () => {
  assert.match(mainSource, /JSB\.require\("DaguanyuanFocusNextCore"\)/);
  assert.match(mainSource, /JSB\.require\("DaguanyuanFocusNextUI"\)/);
  assert.ok(mainSource.indexOf('JSB.require("DaguanyuanFocusNextCore")') < mainSource.indexOf('JSB.require("WebAddon")'));
  assert.match(addonSource, /__DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__\.show\(self\)/);
  assert.match(addonSource, /__DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__\.remove\(self\)/);
  assert.match(addonSource, /toggleFocusNavigation: function/);
});

test("大观园面板提供焦点、跨层级、做题进度、题型分类和上一张开关", () => {
  assert.match(panelSource, /controller\.settingsButton = button\("设置", controller, "openSettings:"\)/);
  assert.match(panelSource, /controller\.settingsPage = new UIView/);
  assert.match(panelSource, /controller\.focusSettingsSection = new UIView/);
  assert.doesNotMatch(panelSource, /controller\.questionSettingsSection = new UIView/);
  assert.match(panelSource, /controller\.focusEnabledSwitch = new UISwitch/);
  assert.match(panelSource, /controller\.focusEnabledSwitch\.addTargetActionForControlEvents\(controller, "toggleFocusNavigation:"/);
  assert.match(panelSource, /controller\.crossLevelSwitch = new UISwitch/);
  assert.match(panelSource, /controller\.crossLevelSwitch\.addTargetActionForControlEvents\(controller, "toggleCrossLevelNavigation:"/);
  assert.match(panelSource, /controller\.progressTitle = label\("显示做题进度"/);
  assert.match(panelSource, /controller\.progressSwitch = new UISwitch/);
  assert.match(panelSource, /controller\.progressSwitch\.addTargetActionForControlEvents\(controller, "toggleProgressDisplay:"/);
  assert.match(panelSource, /controller\.categoryTitle = label\("显示题型分类"/);
  assert.match(panelSource, /controller\.categorySwitch\.addTargetActionForControlEvents\(controller, "toggleCategoryDisplay:"/);
  assert.match(panelSource, /controller\.previousSwitch = new UISwitch/);
  assert.match(panelSource, /controller\.previousSwitch\.addTargetActionForControlEvents\(controller, "togglePreviousButton:"/);
  assert.match(panelSource, /toggleFocusNavigation: function/);
  assert.match(panelSource, /toggleCrossLevelNavigation: function/);
  assert.match(panelSource, /toggleProgressDisplay: function/);
  assert.match(panelSource, /toggleCategoryDisplay: function/);
  assert.match(panelSource, /togglePreviousButton: function/);
  assert.match(panelSource, /refreshFocusSetting/);
  assert.ok(panelSource.indexOf("controller.progressTitle.frame") < panelSource.indexOf("controller.categoryTitle.frame"));
  assert.ok(panelSource.indexOf("controller.categoryTitle.frame") < panelSource.indexOf("controller.previousTitle.frame"));
  assert.doesNotMatch(panelSource, /focusToggleButton|focus-next-icon\.png|loadFocusToggleIcon/);
  assert.doesNotMatch(panelSource, /controller\.focusSwitch/);
  assert.doesNotMatch(panelSource, /openQuestion|打开选中题目|题目操作/);
  assert.equal((addonSource.match(/queryAddonCommandStatus:/g) || []).length, 1);
  assert.match(addonSource, /selector: "togglePanel:"/);
});

test("面板中的焦点开关可以关闭已打开的浮动导航", () => {
  const result = panelToggleRuntime(true);
  assert.deepEqual(result.calls, ["set:false", "hide"]);
  assert.deepEqual(result.hud, []);
  assert.equal(result.addon.focusNavigationEnabled, false);
});

test("上一张关闭时只保留下一张，重新开启后恢复上一张", () => {
  const runtime = focusButtonsRuntime(false);
  runtime.ui.show(runtime.addon);
  assert.equal(runtime.addon.__daguanyuanFocusPreviousButton, undefined);
  assert.ok(runtime.addon.__daguanyuanFocusNextButton);

  runtime.setPreviousEnabled(true);
  runtime.ui.show(runtime.addon);
  assert.ok(runtime.addon.__daguanyuanFocusPreviousButton);

  runtime.setPreviousEnabled(false);
  runtime.ui.show(runtime.addon);
  assert.equal(runtime.addon.__daguanyuanFocusPreviousButton.superview, null);
  assert.equal(runtime.addon.__daguanyuanFocusPreviousButton.hidden, true);
  assert.ok(runtime.addon.__daguanyuanFocusNextButton.superview);
});

test("显示做题进度时导航按钮按实际文字自动调整宽度", () => {
  const runtime = focusButtonsRuntime(true, true);
  runtime.ui.show(runtime.addon);
  assert.equal(runtime.addon.__daguanyuanFocusPreviousButton.title, "上一张（2/3）");
  assert.equal(runtime.addon.__daguanyuanFocusNextButton.title, "下一张（2/3）");
  assert.ok(runtime.addon.__daguanyuanFocusPreviousButton.frame.width > 76);
  assert.ok(runtime.addon.__daguanyuanFocusNextButton.frame.width > 76);

  runtime.setFocusedNote({ noteId: "root" });
  runtime.ui.refreshProgress(runtime.addon, { noteId: "root" });
  assert.equal(runtime.addon.__daguanyuanFocusPreviousButton.title, "上一张");
  assert.equal(runtime.addon.__daguanyuanFocusNextButton.title, "下一张");
  assert.equal(runtime.addon.__daguanyuanFocusPreviousButton.frame.width, 76);
  assert.equal(runtime.addon.__daguanyuanFocusNextButton.frame.width, 76);

  runtime.setProgressEnabled(false);
  runtime.ui.show(runtime.addon);
  assert.equal(runtime.addon.__daguanyuanFocusNextButton.title, "下一张");
  assert.equal(runtime.addon.__daguanyuanFocusNextButton.frame.width, 76);
});

test("取消选中卡片后继续显示最后一次有效焦点的同级进度", () => {
  const runtime = focusButtonsRuntime(false, true);
  runtime.ui.show(runtime.addon);
  assert.equal(runtime.addon.__daguanyuanFocusNextButton.title, "下一张（2/3）");

  runtime.setFocusedNote(undefined);
  runtime.ui.refreshProgress(runtime.addon, undefined);
  assert.equal(runtime.addon.__daguanyuanFocusNextButton.title, "下一张（2/3）");

  runtime.ui.refreshProgress(runtime.addon, runtime.notes.third);
  assert.equal(runtime.addon.__daguanyuanFocusNextButton.title, "下一张（3/3）");
});

test("尚未选择卡片时导航和题型按钮按当前短文字保持紧凑", () => {
  const runtime = focusButtonsRuntime(true, true, true);
  runtime.setFocusedNote(undefined);
  runtime.ui.show(runtime.addon);

  assert.equal(runtime.addon.__daguanyuanFocusPreviousButton.title, "上一张");
  assert.equal(runtime.addon.__daguanyuanFocusNextButton.title, "下一张");
  assert.equal(runtime.addon.__daguanyuanFocusPreviousButton.frame.width, 76);
  assert.equal(runtime.addon.__daguanyuanFocusNextButton.frame.width, 76);
  assert.equal(runtime.addon.__daguanyuanFocusCategoryButton.title, "无题型分类");
  assert.equal(runtime.addon.__daguanyuanFocusCategoryButton.frame.width, 98);
});

test("题型分类按钮默认关闭，开启后显示直属父节点并保存独立位置", () => {
  const runtime = focusButtonsRuntime(true, false, false);
  runtime.ui.show(runtime.addon);
  assert.equal(runtime.addon.__daguanyuanFocusCategoryButton, undefined);

  runtime.setCategoryEnabled(true);
  runtime.ui.show(runtime.addon);
  const button = runtime.addon.__daguanyuanFocusCategoryButton;
  assert.equal(button.title, "函数性质");
  assert.equal(button.frame.width, 84);
  assert.equal(button.action, undefined);
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

test("点击前后导航后立即刷新按钮进度", () => {
  assert.match(addonSource, /refreshProgress\(self, result\.next\)/);
  assert.equal((addonSource.match(/refreshProgress\(self, result\.next\)/g) || []).length, 2);
  assert.equal((addonSource.match(/refreshCategory\(self, result\.next\)/g) || []).length, 2);
});

test("焦点总开关沿用持久化状态并通过设置页切换", () => {
  assert.match(panelSource, /controller\.focusEnabledSwitch\.on = enabled/);
  assert.match(panelSource, /sender && typeof sender\.on !== "undefined"/);
  assert.match(addonSource, /__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__\.enabled\(\)/);
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

test("移除顶部焦点图标后插件入口不再传递资源路径", () => {
  assert.match(mainSource, /JSB\.newAddon = function \(\)/);
  assert.match(addonSource, /createController\(self\)/);
  assert.doesNotMatch(mainSource + addonSource + panelSource, /focus-next-icon\.png|createController\(mainPath/);
});
