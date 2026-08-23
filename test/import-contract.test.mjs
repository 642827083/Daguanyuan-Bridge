import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/DaguanyuanImport.js", import.meta.url), "utf8");
const addonSource = readFileSync(new URL("../src/WebAddon.js", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");

test("原生导入器以撤销组创建分类子节点并以题目 ID 去重", () => {
  assert.match(source, /UndoManager\.sharedInstance\(\)\.undoGrouping/);
  assert.match(source, /Note\.createWithTitleNotebookDocument/);
  assert.match(source, /addChild\(/);
  assert.match(source, /DAGUANYUAN_QUESTION_ID:/);
  assert.match(source, /refreshAfterDBChanged/);
  assert.match(source, /Database\.sharedInstance\(\)\.getNotebookById/);
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

test("面板提供大观园和 408 真题入口", () => {
  assert.match(panelSource, /https:\/\/cxyonly\.fans\/math/);
  assert.match(panelSource, /https:\/\/www\.408os\.cn\/overview/);
  assert.match(panelSource, /button\("大观园"/);
  assert.match(panelSource, /button\("408 真题"/);
  assert.match(panelSource, /throw new Error\("题库地址无效"\)/);
});

test("面板提供打开选中题目按钮并读取脑图选择", () => {
  assert.match(panelSource, /打开选中题目/);
  assert.match(panelSource, /openSelectedQuestion:/);
  assert.match(panelSource, /__DAGUANYUAN_SELECTION_GLOBAL__\.firstSelectedQuestionURL/);
});

test("题卡正文保存隐藏原题链接", () => {
  assert.match(source, /DAGUANYUAN_URL/);
  assert.match(source, /question\.url/);
});
