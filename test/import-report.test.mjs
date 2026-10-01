import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/DaguanyuanImportReport.js", import.meta.url), "utf8");

function runtime() {
  class View {
    constructor(frame) { this.frame = frame; this.layer = {}; this.children = []; this.titleLabel = {}; }
    addSubview(child) { this.children = this.children.filter((item) => item !== child); this.children.push(child); child.superview = this; }
    setTitleForState(title) { this.title = title; }
    setTitleColorForState() {}
    addTargetActionForControlEvents(controller, selector) { this.selector = selector; }
  }
  const color = { colorWithAlphaComponent() { return this; } };
  const pasteboard = {};
  const context = {
    UIView: View, UILabel: View, UIButton: View, UITextView: View, UIScrollView: View,
    UIFont: { systemFontOfSize() {}, boldSystemFontOfSize() {} },
    UIColor: { whiteColor() { return color; }, darkGrayColor() { return color; }, lightGrayColor() { return color; }, colorWithRedGreenBlueAlpha() { return color; } },
    UIPasteboard: { generalPasteboard() { return pasteboard; } },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, report: context.__DAGUANYUAN_IMPORT_REPORT_GLOBAL__, pasteboard, controller: { view: { bounds: { width: 560, height: 420 } }, containerView: new View({}) } };
}

test("失败详情完整保留全部题号、阶段和长原因，清除图片数据及资源查询凭据", () => {
  const { report } = runtime();
  const failed = Array.from({ length: 120 }, (_, index) => ({ questionId: index + 1, source: `2026年 第${index + 1}题`, stage: "下载图片", reason: "原因".repeat(100) }));
  failed[0].reason = "https://oss.408os.cn/img.svg?token=SECRET#x data:image/png;base64,AQID";
  failed[0].diagnostics = { processorAvailable: false, remainingImages: 2 };
  const text = report.textFor({ createdCount: 4, skippedCount: 8, failed });
  assert.match(text, /失败 120 道/);
  assert.match(text, /第120题/);
  assert.match(text, new RegExp("原因".repeat(100)));
  assert.match(text, /接口可用：false/);
  assert.doesNotMatch(text, /SECRET|AQID|data:image/);
});

test("详情可停留查看、滚动、复制，关闭及再次显示均保留当前布局", () => {
  const { report, controller, pasteboard } = runtime();
  report.show(controller, { failed: [{ questionId: 44, source: "2026年 第44题", reason: "图片解码失败" }] });
  assert.equal(controller.importReportView.hidden, false);
  assert.equal(controller.containerView.children.at(-1), controller.importReportView);
  assert.equal(controller.importReportText.editable, false);
  assert.equal(controller.importReportText.selectable, true);
  assert.equal(controller.importReportCopy.selector, "copyCategoryImportReport:");
  assert.equal(report.copy(controller), true);
  assert.equal(pasteboard.string, controller.importReportText.text);
  report.close(controller);
  assert.equal(controller.importReportView.hidden, true);
  controller.view.bounds = { width: 960, height: 680 };
  report.show(controller, { failed: [], interrupted: "当前分类已切换" });
  assert.match(controller.importReportText.text, /当前分类已切换/);
  assert.equal(controller.importReportView.hidden, false);
  assert.equal(controller.importReportView.frame.width, 936);
  assert.equal(controller.containerView.children.length, 1);
});

test("宿主文本视图不可用时使用滚动标签显示详情并支持复制和调整大小", () => {
  const { context, controller, report, pasteboard } = runtime();
  delete context.UITextView;
  report.show(controller, { failed: Array.from({ length: 80 }, (_, index) => ({ questionId: index + 1, reason: "图片保存失败" })) });
  assert.equal(controller.importReportView.hidden, false);
  assert.equal(controller.importReportBodyLabel.numberOfLines, 0);
  assert.match(controller.importReportBodyLabel.text, /题目 ID：80/);
  assert.ok(controller.importReportText.contentSize.height > controller.importReportText.frame.height);
  report.copy(controller);
  assert.equal(pasteboard.string, controller.importReportBodyLabel.text);
  const previous = controller.importReportText.contentSize.height;
  controller.view.bounds.width = 960;
  report.layout(controller);
  assert.ok(controller.importReportText.contentSize.height <= previous);
});

test("网页导入命令的失败结果和中断信息会显示原生详情，不仅显示计数提示", async () => {
  const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");
  for (const interrupted of [false, true]) {
    const { context, controller, report } = runtime();
    let methods;
    const messages = [];
    context.JSB = { defineClass(name, value) { methods = value; return {}; } };
    context.console = { log() {} };
    context.NSUserDefaults = { standardUserDefaults() { return { objectForKey() { return true; } }; } };
    context.Application = { sharedInstance() { return { showHUD(text) { messages.push(text); } }; } };
    context.__DAGUANYUAN_VIDEO_BROWSER_GLOBAL__ = { handles() { return false; } };
    const result = { total: 47, createdCount: 40, skippedCount: 6, failed: [{ questionId: 44, source: "2026年 第44题", stage: "MarginNote 保存图片", reason: "保存失败" }] };
    context.__DAGUANYUAN_408_IMPORT_GLOBAL__ = { async importCategory() {
      if (interrupted) { const error = new Error("当前分类已切换"); error.importResult = result; throw error; }
      return result;
    } };
    controller.webView = { evaluateJavaScript(script, callback) { callback(true); } };
    controller.addon = { window: {} };
    controller.currentContentPage = "408";
    context.self = controller;
    vm.runInContext(panelSource, context);
    const shown = new Promise((resolve) => {
      const show = report.show;
      report.show = (target, value) => { show(target, value); resolve(); };
    });
    assert.equal(methods.webViewShouldStartLoadWithRequestNavigationType(controller.webView, { URL: { absoluteString: "daguanyuanbridge://import-category" } }), false);
    await shown;
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(controller.importReportText.text, /2026年 第44题/);
    assert.match(controller.importReportText.text, /失败阶段：MarginNote 保存图片/);
    assert.match(controller.importReportText.text, /失败原因：保存失败/);
    if (interrupted) assert.match(controller.importReportText.text, /当前分类已切换/);
    assert.equal(controller.categoryImportBusy, false);
    assert.equal(messages.some((text) => text.includes("导入完成")), false);
    methods.copyCategoryImportReport();
    methods.closeCategoryImportReport();
    assert.equal(controller.importReportView.hidden, true);
  }
});

test("失败详情控件抛错时仍结束导入、恢复网页按钮，并保留原始失败原因", async () => {
  const { context, controller } = runtime();
  let methods;
  const messages = [];
  const finished = [];
  context.JSB = { defineClass(name, value) { methods = value; return {}; } };
  context.console = { log() {} };
  context.NSUserDefaults = { standardUserDefaults() { return { objectForKey() { return true; } }; } };
  context.Application = { sharedInstance() { return { showHUD(text) { messages.push(text); } }; } };
  context.__DAGUANYUAN_VIDEO_BROWSER_GLOBAL__ = { handles() { return false; } };
  context.__DAGUANYUAN_408_IMPORT_GLOBAL__ = { async importCategory() {
    return { total: 1, createdCount: 0, skippedCount: 0, failed: [{ questionId: 44, reason: "图片保存失败" }] };
  } };
  context.UITextView = class { constructor() { throw Error("详情控件创建失败"); } };
  context.UIScrollView = context.UITextView;
  controller.webView = { evaluateJavaScript(script, callback) { if (script.includes(".finishImport()")) finished.push(script); callback(true); } };
  controller.addon = { window: {} };
  controller.currentContentPage = "408";
  context.self = controller;
  // 捕获真实异步链的结束结果，避免旧代码未处理的异常影响其他测试。
  vm.runInContext("const originalThen = Promise.prototype.then; Promise.prototype.then = function (...args) { const result = originalThen.apply(this, args); originalThen.call(result, undefined, function () {}); globalThis.lastChain = result; return result; };", context);
  vm.runInContext(readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8"), context);
  methods.webViewShouldStartLoadWithRequestNavigationType(controller.webView, { URL: { absoluteString: "daguanyuanbridge://import-category" } });
  await context.lastChain.catch(() => {});
  assert.equal(controller.categoryImportBusy, false);
  assert.equal(finished.length, 1);
  assert.match(controller.lastCategoryImportReportText, /图片保存失败/);
  assert.ok(messages.some((text) => text.includes("图片保存失败")));
});
