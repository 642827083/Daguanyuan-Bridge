import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/DaguanyuanImport.js", import.meta.url), "utf8");
const addonSource = readFileSync(new URL("../src/WebAddon.js", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");
const bridgeSource = readFileSync(new URL("../src/WebBridgeCommands.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

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
  assert.match(panelSource, /__DAGUANYUAN_SELECTION_GLOBAL__\.firstSelectedQuestion/);
  assert.match(panelSource, /firstSelectedDaguanyuanCategory/);
  assert.match(panelSource, /function loadCategory\(controller, category\)/);
  assert.match(panelSource, /loadURL\(self, selected\.url, selected\.questionId, selected\.provider\)/);
  assert.match(panelSource, /injectSelectedQuestionLocator\(self\)/);
  assert.match(panelSource, /injectCategoryNavigation\(self\)/);
  assert.match(panelSource, /questionLocatorScript\(questionId\)/);
  assert.match(panelSource, /os408QuestionLocatorScript\(questionId\)/);
  assert.match(panelSource, /orderedQuestionLocatorScript\(binding\.questionIndex\)/);
  assert.match(panelSource, /saveQuestionMappings/);
});

test("首次按顺序定位保存映射后立即加载精确题目地址", () => {
  const start = panelSource.indexOf("function finishOrderedQuestionBinding");
  const end = panelSource.indexOf("function scheduleOrderedQuestionBinding", start);
  const bindingSource = panelSource.slice(start, end);
  const saveIndex = bindingSource.indexOf("saveQuestionMappings");
  const loadIndex = bindingSource.indexOf('loadURL(controller, result.url, result.questionId, "daguanyuan")');

  assert.ok(start >= 0 && end > start);
  assert.ok(saveIndex >= 0);
  assert.ok(loadIndex > saveIndex, "首次懒绑定后必须立即加载带 questionId 的精确地址");
});

test("首次按顺序定位区分网页总题数与已读取题数", () => {
  assert.match(panelSource, /网页显示共.*但只读取到/);
  assert.doesNotMatch(panelSource, /网页当前只有/);
});

test("问AI按钮位于打开选中题目右侧并打开所选题目的 AI 助手", () => {
  assert.match(panelSource, /button\("问AI", controller, "openSelectedQuestionAI:"\)/);
  assert.match(panelSource, /controller\.openQuestionButton\.frame\s*=\s*\{ x: 204,[^}]+\}/);
  assert.match(panelSource, /controller\.aiButton\.frame\s*=\s*\{ x: 328,[^}]+\}/);
  assert.match(panelSource, /openSelectedQuestionAI:\s*function\s*\(sender\)/);
  assert.match(panelSource, /__DAGUANYUAN_SELECTION_GLOBAL__\.firstSelectedQuestionAIURL/);
});

test("题卡正文保存隐藏题目编号和原题链接", () => {
  assert.match(source, /DAGUANYUAN_QUESTION_ID/);
  assert.match(source, /DAGUANYUAN_URL/);
  assert.match(source, /question\.url/);
});

test("数学分类保留网站中的极限层级且不包含旧迁移逻辑", () => {
  assert.match(source, /const incomingPath = Array\.isArray\(payload\.categoryPath\)/);
  assert.doesNotMatch(source, /findLegacyCategory|migrateFlattenedLimitBranch|mergeCategoryChildren|mergeLegacyLimitBranch/);
  assert.doesNotMatch(source, /DAGUANYUAN_CATEGORY_ID:/);
  assert.doesNotMatch(source, /题目 \$\{questionId\}/);
  assert.doesNotMatch(source, /daguanyuan-408-question:/);
});

test("面板移除导入当前分类及状态栏运行链", () => {
  assert.doesNotMatch(panelSource, /导入当前分类/);
  assert.doesNotMatch(panelSource, /importCurrentPractice|importButton|beginCollection/);
  assert.doesNotMatch(panelSource, /statusBar|statusLabel|setStatus|STATUS_HEIGHT|HEADER_HEIGHT/);
  assert.doesNotMatch(panelSource, /schedulePageStatusRefresh|readPageStatus|pageStatusScript/);
  assert.doesNotMatch(bridgeSource, /importCurrentPractice/);
  assert.doesNotMatch(mainSource, /JSB\.require\("DaguanyuanImport"\)/);
  assert.match(panelSource, /webView\.frame\s*=\s*\{ x: 0, y: TITLE_HEIGHT/);
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

test("408 题卡使用简化 HTML 外框而非网页原始布局", () => {
  const collectorSource = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  assert.match(collectorSource, /function compactHTML/);
  assert.match(collectorSource, /border-radius:8px/);
  assert.match(collectorSource, /width: 960/);
  assert.doesNotMatch(collectorSource, /html2canvas/);
});

test("大观园数学使用 Markdown 题卡，408 保持简化 HTML 题卡", () => {
  const collectorSource = readFileSync(new URL("../src/DaguanyuanPageCollector.js", import.meta.url), "utf8");
  assert.doesNotMatch(mainSource, /KatexAssets/);
  assert.doesNotMatch(collectorSource, /var html = simplifiedQuestionHTML\(stem, optionNodes/);
  assert.match(collectorSource, /markdown: questionMarkdown\(stem, optionNodes\)/);
  assert.match(collectorSource, /function renderedQuestionHTML/);
});

test("错题复测页面通过受控指令定位脑图并隐藏面板", () => {
  assert.match(mainSource, /JSB\.require\("DaguanyuanRetest"\)/);
  assert.match(panelSource, /webViewShouldStartLoadWithRequestNavigationType/);
  assert.match(panelSource, /questionIdFromBridgeURL/);
  assert.match(panelSource, /resolveRetestQuestion/);
  assert.match(panelSource, /scheduleRetestQuestionFocus/);
  assert.match(panelSource, /NSTimer\.scheduledTimerWithTimeInterval\(0\.2/);
  assert.match(panelSource, /startQuestionNavigation\(controller\.addon/);
  assert.match(panelSource, /notebookIds:\s*Array\.isArray\(notebookIds\) \? notebookIds : \[\]/);
  assert.match(panelSource, /enhancementScript\(\)/);
  assert.doesNotMatch(readFileSync(new URL("../src/DaguanyuanRetest.js", import.meta.url), "utf8"), /setContentOffsetAnimated|mindmapNodes|scrollQuestionCard/);
  assert.match(bridgeSource, /resolveRetestQuestion/);
  const delegate = panelSource.slice(panelSource.indexOf("webViewShouldStartLoadWithRequestNavigationType"));
  assert.ok(delegate.indexOf("performClosePanel(self)") < delegate.indexOf("scheduleRetestQuestionFocus(self, result.note, result.noteId, self.pendingRetestNotebookIds)"));
  assert.match(delegate, /scheduleRetestQuestionFocus\(self, result\.note, result\.noteId, self\.pendingRetestNotebookIds\)/);
});

test("跨学习集定位使用原生 NSURL，并将学习集打开事件传回导航器", () => {
  const retestSource = readFileSync(new URL("../src/DaguanyuanRetest.js", import.meta.url), "utf8");
  assert.match(retestSource, /NSURL\.URLWithString\(encodeURI\(target\)\)/);
  assert.match(retestSource, /application\.openURL\(url\)/);
  assert.doesNotMatch(retestSource, /application\.openURL\(target,/);
  assert.match(retestSource, /function resumePendingNavigation\(addon, openedNotebookId\)/);
  assert.match(retestSource, /opened !== pending\.notebookId/);
  assert.match(addonSource, /notebookWillOpen:\s*function\s*\(openedNotebookId\)/);
  assert.match(addonSource, /resumePendingNavigation\(self, openedNotebookId\)/);
});
