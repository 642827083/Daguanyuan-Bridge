import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from 'node:vm';

const addonSource = readFileSync(new URL("../src/WebAddon.js", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const videoSource = readFileSync(new URL("../src/DaguanyuanVideoBrowser.js", import.meta.url), "utf8");

test("面板提供独立导入页并保留题目工具中的分类导入开关", () => {
  assert.match(panelSource, /button\("数学", controller, "openDaguanyuan:"\)/);
  assert.match(panelSource, /button\("408", controller, "open408:"\)/);
  assert.match(panelSource, /button\("设置", controller, "openSettings:"\)/);
  assert.match(panelSource, /button\("导入", controller, "openImport:"\)/);
  assert.ok(panelSource.indexOf('controller.os408Button = button') < panelSource.indexOf('controller.importButton = button'));
  assert.ok(panelSource.indexOf('controller.importButton = button') < panelSource.indexOf('controller.settingsButton = button'));
  assert.match(panelSource, /显示导入题目/);
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
  assert.doesNotMatch(addonSource, /questionForNote\(/);
  assert.match(addonSource, /currentQuestionContext\(self, focused\)/);
  assert.match(mainSource, /JSB\.require\("DaguanyuanSourceLink"\)/);
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

test('隐藏的导入页不加载或恢复，旧入口返回当前题库并停止旧任务，独立网页通信仍隔离', () => {
  let methods, htmlLoads = 0, resumes = 0, bridgeContext;
  const button = () => ({ layer: {}, setTitleColorForState() {} });
  const controller = { activePage: 'math', currentContentPage: 'math', settingsPage: {}, categoryManagerPage: {},
    homeButton: button(), os408Button: button(), importButton: button(), settingsButton: button(), importReportView: { hidden: false },
    webView: { loadRequest() { throw Error('不应重载原网页'); } },
    importWebView: { loadHTMLStringBaseURL(html, base) { assert.equal(html, '<html>导入页</html>'); assert.equal(base, null); htmlLoads++; },
      evaluateJavaScript(script, cb) { assert.match(script, /resume/); resumes++; cb(); } } };
  const context = { self: controller,
    JSB: { defineClass(name, value) { methods = value; return {}; } },
    UIColor: { colorWithWhiteAlpha() { return {}; }, colorWithRedGreenBlueAlpha() { return {}; }, darkGrayColor() { return {}; } },
    __DAGUANYUAN_CARD_LOCATOR_UI_GLOBAL__: { cancelMode() {} },
    __DAGUANYUAN_IMPORT_WORKSPACE_HTML__: '<html>导入页</html>',
    __DAGUANYUAN_IMPORT_WORKSPACE_GLOBAL__: { close(panel) { panel.importWorkspaceTask.cancelled = true; } },
    __DAGUANYUAN_WEB_BRIDGE_COMMANDS_GLOBAL__: { handle(ctx) { bridgeContext = ctx; } },
  };
  vm.runInNewContext(panelSource, context);
  methods.openImport();
  assert.equal(controller.activePage, 'math'); assert.equal(controller.webView.hidden, false);
  assert.equal(controller.importWebView.hidden, true);
  assert.equal(htmlLoads, 0);
  const allowed = address => methods.webViewShouldStartLoadWithRequestNavigationType(controller.importWebView, { URL: { absoluteString: address } });
  assert.equal(allowed('daguanyuanbridge://ui?payload=test'), false);
  assert.equal(bridgeContext.webView, controller.importWebView); assert.equal(bridgeContext.isImportWorkspace, true);
  assert.equal(allowed('about:blank'), true); assert.equal(allowed('https://example.com'), false);
  controller.importWorkspaceTask = { cancelled: false }; methods.openDaguanyuan();
  assert.equal(controller.webView.hidden, false); assert.equal(controller.importWebView.hidden, true);
  assert.equal(controller.importWorkspaceTask.cancelled, true);
  controller.currentContentPage = '408'; methods.openImport();
  assert.equal(controller.activePage, '408'); assert.equal(controller.importWebView.hidden, true);
  assert.equal(htmlLoads, 0); assert.equal(resumes, 0);
});
