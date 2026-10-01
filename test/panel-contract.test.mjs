import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const addonSource = readFileSync(new URL("../src/WebAddon.js", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const videoSource = readFileSync(new URL("../src/DaguanyuanVideoBrowser.js", import.meta.url), "utf8");

test("面板移除旧导入页并在题目导航中提供分类导入开关", () => {
  assert.match(panelSource, /button\("数学", controller, "openDaguanyuan:"\)/);
  assert.match(panelSource, /button\("408", controller, "open408:"\)/);
  assert.match(panelSource, /button\("设置", controller, "openSettings:"\)/);
  assert.doesNotMatch(panelSource, /importWebView|openImport:/);
  assert.match(panelSource, /显示导入当前题目/);
  assert.match(panelSource, /在数学与 408 页导入当前分类全部题目/);
  assert.match(panelSource, /toggleCategoryImportDisplay:/);
  assert.match(panelSource, /handleCategoryImport\(self\)/);
});

test("入口加载数学取题、建卡和双向定位模块", () => {
  assert.equal(existsSync(new URL("../src/DaguanyuanMathImport.js", import.meta.url)), true);
  assert.equal(existsSync(new URL("../web/src/main.js", import.meta.url)), false);
  assert.match(mainSource, /JSB\.require\("DaguanyuanMathApi"\)/);
  assert.match(mainSource, /JSB\.require\("DaguanyuanMathImport"\)/);
  assert.match(mainSource, /JSB\.require\("Daguanyuan408Import"\)/);
  assert.match(mainSource, /JSB\.require\("DaguanyuanRetestBridge"\)/);
  assert.match(mainSource, /JSB\.require\("DaguanyuanWebsiteBridge"\)/);
  assert.match(panelSource, /injectWebsiteButtons\(self\)/);
  assert.match(addonSource, /questionForNote\(focused\)/);
});

test("工具栏与网站跳转仍保留", () => {
  assert.match(addonSource, /image:\s*"icon\.png"/);
  assert.match(mainSource, /JSB\.require\("DaguanyuanVideoBrowser"\)/);
  assert.match(panelSource, /__DAGUANYUAN_VIDEO_BROWSER_GLOBAL__\.pageScript\(\)/);
  assert.match(panelSource, /__DAGUANYUAN_VIDEO_BROWSER_GLOBAL__\.handles\(address\)/);
  assert.match(videoSource, /window\.open = function/);
  assert.match(panelSource, /injectVideoPopupCompatibility\(self\)/);
  assert.match(addonSource, /openDaguanyuanQuestion\(self\.panelController, route\)/);
});
