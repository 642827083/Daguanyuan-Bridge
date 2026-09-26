import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const addonSource = readFileSync(new URL("../src/WebAddon.js", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

test("面板只保留数学、408 和设置入口", () => {
  assert.match(panelSource, /button\("数学", controller, "openDaguanyuan:"\)/);
  assert.match(panelSource, /button\("408", controller, "open408:"\)/);
  assert.match(panelSource, /button\("设置", controller, "openSettings:"\)/);
  assert.doesNotMatch(panelSource, /importPage|importButton|openImport:|setupImportPage/);
});

test("题目读取和建卡模块已从插件入口及页面移除", () => {
  assert.equal(existsSync(new URL("../src/DaguanyuanMathImport.js", import.meta.url)), false);
  assert.doesNotMatch(mainSource, /DaguanyuanMathImport/);
  assert.doesNotMatch(panelSource, /__DAGUANYUAN_MATH_IMPORT_GLOBAL__|captureHTMLScript|capture-html-ready|websiteQuestionFocusScript/);
  assert.doesNotMatch(addonSource, /__DAGUANYUAN_MATH_IMPORT_GLOBAL__|importCaptureWebView/);
});

test("工具栏与网站跳转仍保留", () => {
  assert.match(addonSource, /image:\s*"icon\.png"/);
  assert.match(panelSource, /videoPopupCompatibilityScript/);
  assert.match(panelSource, /window\.open = function/);
  assert.match(panelSource, /injectVideoPopupCompatibility\(self\)/);
  assert.match(addonSource, /openDaguanyuanQuestion\(self\.panelController, resolvedRoute\)/);
});
