import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const addonSource = readFileSync(new URL("../src/WebAddon.js", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

test("题卡导入与页面采集模块已从原生层和网页层删除", () => {
  const removedFiles = [
    "../src/DaguanyuanImport.js",
    "../src/DaguanyuanPageCollector.js",
    "../web/src/domain/practiceParser.mjs",
    "../web/src/site/practiceCollector.mjs",
  ];
  removedFiles.forEach((file) => assert.equal(existsSync(new URL(file, import.meta.url)), false));
  assert.doesNotMatch(mainSource, /DaguanyuanImport|DaguanyuanPageCollector/);
});

test("工具栏命令声明包内图标", () => {
  assert.match(addonSource, /image:\s*"icon\.png"/);
});

test("工具栏图标按面板是否附着切换显示与隐藏", () => {
  assert.match(addonSource, /__DAGUANYUAN_WEB_PANEL_GLOBAL__\.isPanelVisible/);
  assert.doesNotMatch(addonSource, /panelController\.view\.window/);
  assert.match(panelSource, /panelVisible/);
});

test("工具栏 selector 对应的方法接收 sender 参数", () => {
  assert.match(addonSource, /togglePanel:\s*function\s*\(sender\)/);
});

test("正式工具栏切换不显示诊断弹窗", () => {
  assert.doesNotMatch(addonSource, /showHUD\(/);
  assert.doesNotMatch(addonSource, /togglePanel before/);
  assert.doesNotMatch(addonSource, /togglePanel after/);
});

test("隐藏面板直接移除视图并延迟刷新工具栏", () => {
  assert.match(panelSource, /function performClosePanel\(controller\)/);
  assert.match(panelSource, /NSTimer\.scheduledTimerWithTimeInterval\(0/);
  assert.match(panelSource, /function hidePanel\(controller\)\s*\{\s*performClosePanel\(controller\);/);
});

test("面板提供右下角缩放手势并限制和保存尺寸", () => {
  assert.match(panelSource, /resizeHandle/);
  assert.match(panelSource, /new UIPanGestureRecognizer\(controller, "resizePanel:"\)/);
  assert.match(panelSource, /resizePanel: function/);
  assert.match(panelSource, /safeFrame\(resizedFrame, superview\.bounds\)/);
  assert.match(panelSource, /persistFrame\(self\)/);
});

test("面板顶栏只提供数学、408 和设置三个入口", () => {
  assert.match(panelSource, /https:\/\/cxyonly\.fans\/math/);
  assert.match(panelSource, /https:\/\/www\.408os\.cn\/overview/);
  assert.match(panelSource, /button\("数学"/);
  assert.match(panelSource, /button\("408"/);
  assert.match(panelSource, /button\("设置", controller, "openSettings:"\)/);
  assert.doesNotMatch(panelSource, /controller\.openQuestionButton|controller\.aiButton|controller\.focusButton/);
  assert.doesNotMatch(panelSource, /controller\.titleLabel|\.text\s*=\s*"Daguanyuan Bridge"/);
  assert.match(panelSource, /throw new Error\("题库地址无效"\)/);
});

test("独立设置页和运行入口完整移除打开选中题目功能", () => {
  assert.match(panelSource, /controller\.settingsPage = new UIScrollView/);
  assert.match(panelSource, /function setActivePage\(controller, page\)/);
  assert.match(panelSource, /controller\.settingsPage\.hidden = page !== "settings"/);
  assert.doesNotMatch(panelSource, /settingsMenu|settingsBackdropButton/);
  assert.doesNotMatch(panelSource + addonSource, /打开选中题目|打开题目|openSelectedQuestion|firstSelectedQuestion|loadCategory|questionLocatorScript|scopedOrderedQuestionLocatorScript/);
  assert.doesNotMatch(mainSource, /DaguanyuanSelection|DaguanyuanStorage/);
});

test("面板完整移除问 AI 功能", () => {
  assert.doesNotMatch(panelSource, /问AI|openSelectedQuestionAI|firstSelectedQuestionAIURL/);
});

test("面板移除导入当前分类及状态栏运行链", () => {
  assert.doesNotMatch(panelSource, /导入当前分类/);
  assert.doesNotMatch(panelSource, /importCurrentPractice|importButton|beginCollection/);
  assert.doesNotMatch(panelSource, /statusBar|statusLabel|setStatus|STATUS_HEIGHT|HEADER_HEIGHT/);
  assert.doesNotMatch(panelSource, /schedulePageStatusRefresh|readPageStatus|pageStatusScript/);
  assert.doesNotMatch(mainSource, /WebBridgeCommands/);
  assert.doesNotMatch(mainSource, /DaguanyuanImport|DaguanyuanPageCollector/);
  assert.match(panelSource, /controller\.webView\.frame = contentFrame/);
});

test("面板已移除旧题卡匹配、目录设置和离线图片入口", () => {
  assert.doesNotMatch(panelSource, /离线图：/);
  assert.doesNotMatch(panelSource, /设为目录/);
  assert.doesNotMatch(panelSource, /匹配旧题卡/);
  assert.doesNotMatch(panelSource, /toggleOfflineImages:/);
  assert.doesNotMatch(panelSource, /setPracticeRoot:/);
  assert.doesNotMatch(panelSource, /matchLegacyCards:/);
});

test("插件将视频的新窗口跳转保留在当前面板", () => {
  assert.match(panelSource, /videoPopupCompatibilityScript/);
  assert.match(panelSource, /window\.open = function/);
  assert.match(panelSource, /getAttribute\("target"\)/);
  assert.match(panelSource, /injectVideoPopupCompatibility\(self\)/);
});

test("插件不再注入错题复测定位脑图逻辑", () => {
  assert.doesNotMatch(mainSource, /DaguanyuanRetest|WebBridgeCommands/);
  assert.doesNotMatch(panelSource, /RETEST|Retest|retest|错题复测|复测|focus-question/);
  assert.doesNotMatch(addonSource, /DAGUANYUAN_RETEST|resumePendingNavigation/);
});
