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
    focusButton: { setTitleForState() {}, setTitleColorForState() {} },
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

test("集成模块使用 Daguanyuan Bridge 独立命名空间和持久化键", () => {
  const defaults = {};
  const core = runtime({ notebookController: {} }, defaults);
  assert.equal(core.enabled(), true);
  core.setEnabled(false);
  assert.equal(defaults["cn.marginnote.daguanyuan-bridge.focus-next.enabled"], false);
  assert.doesNotMatch(coreSource + uiSource, /__FOCUS_NEXT_/);
  assert.doesNotMatch(coreSource + uiSource, /__focus/);
  assert.match(uiSource, /daguanyuan-bridge\.focus-next\.next-button-position/);
  assert.match(uiSource, /daguanyuan-bridge\.focus-next\.previous-button-position/);
});

test("插件生命周期接入焦点按钮并在断开时清理", () => {
  assert.match(mainSource, /JSB\.require\("DaguanyuanFocusNextCore"\)/);
  assert.match(mainSource, /JSB\.require\("DaguanyuanFocusNextUI"\)/);
  assert.ok(mainSource.indexOf('JSB.require("DaguanyuanFocusNextCore")') < mainSource.indexOf('JSB.require("WebAddon")'));
  assert.match(addonSource, /__DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__\.show\(self\)/);
  assert.match(addonSource, /__DAGUANYUAN_FOCUS_NEXT_UI_GLOBAL__\.remove\(self\)/);
  assert.match(addonSource, /toggleFocusNavigation: function/);
});

test("大观园面板提供焦点开关且不占用第二个工具栏命令", () => {
  assert.match(panelSource, /controller\.focusButton = button\("焦点开"/);
  assert.match(panelSource, /toggleFocusNavigation: function/);
  assert.match(panelSource, /refreshFocusButton/);
  assert.equal((addonSource.match(/queryAddonCommandStatus:/g) || []).length, 1);
  assert.match(addonSource, /selector: "togglePanel:"/);
});

test("面板中的焦点开关可以关闭已打开的浮动导航", () => {
  const result = panelToggleRuntime(true);
  assert.deepEqual(result.calls, ["set:false", "hide"]);
  assert.deepEqual(result.hud, []);
  assert.equal(result.addon.focusNavigationEnabled, false);
});

test("插件图标使用带透明通道的 48 像素 PNG", () => {
  assert.equal(icon.toString("ascii", 1, 4), "PNG");
  assert.equal(icon.readUInt32BE(16), 48);
  assert.equal(icon.readUInt32BE(20), 48);
  assert.equal(icon[25], 6);
});
