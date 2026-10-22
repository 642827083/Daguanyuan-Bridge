import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

const catalogFixture = JSON.parse(readFileSync(new URL("./fixtures/math-category-catalog.json", import.meta.url), "utf8"));
const catalogStoreSource = readFileSync(new URL("../src/DaguanyuanCategoryCatalogStore.js", import.meta.url), "utf8");
const routesSource = readFileSync(new URL("../src/DaguanyuanCategoryRoutes.js", import.meta.url), "utf8");
const os408RoutesSource = readFileSync(new URL("../src/Daguanyuan408Routes.js", import.meta.url), "utf8");
const storeSource = readFileSync(new URL("../src/DaguanyuanCategoryMappingStore.js", import.meta.url), "utf8");
const managerSource = readFileSync(new URL("../src/DaguanyuanCategoryManagerUI.js", import.meta.url), "utf8");
const addonSource = readFileSync(new URL("../src/WebAddon.js", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");
const videoSource = readFileSync(new URL("../src/DaguanyuanVideoBrowser.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

function runtime() {
  const files = new Map();
  const directories = new Set(["/documents"]);
  const manager = {
    fileExistsAtPath(path) {
      return files.has(String(path)) || directories.has(String(path));
    },
    createDirectoryAtPathWithIntermediateDirectoriesAttributes(path) {
      directories.add(String(path));
      return true;
    },
  };
  const context = {
    Application: { sharedInstance() { return { documentPath: "/documents" }; } },
    NSFileManager: { defaultManager() { return manager; } },
    NSData: {
      dataWithContentsOfFile(path) {
        return files.get(String(path));
      },
    },
    NSJSONSerialization: {
      JSONObjectWithDataOptions(data) {
        return JSON.parse(data.text);
      },
      dataWithJSONObjectOptions(value) {
        return {
          text: JSON.stringify(value),
          writeToFileAtomically(path) {
            files.set(String(path), { text: this.text });
            return true;
          },
        };
      },
    },
    Number, String, Array, Object, JSON, Math, RegExp, Date,
    encodeURIComponent, decodeURIComponent, console,
  };
  vm.createContext(context);
  vm.runInContext(catalogStoreSource, context);
  vm.runInContext(routesSource, context);
  context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__.replaceCatalog(catalogFixture);
  vm.runInContext(os408RoutesSource, context);
  vm.runInContext(storeSource, context);
  return { context, files };
}

test("绑定以学习集和父节点 ID 为键，同一父节点的题卡共用并可重新绑定", () => {
  const { context } = runtime();
  const store = context.__DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__;
  const source = {
    notebookId: "notebook-1",
    parentNoteId: "parent-1",
    parentTitle: "0/0",
    sourcePath: ["高等数学", "极限", "0/0"],
  };

  assert.equal(store.bindingForSource(source), undefined);
  store.saveBinding(source, 704);
  assert.equal(store.bindingForSource(source).targetCategoryId, 704);
  assert.equal(store.bindingForSource({ ...source, sourcePath: ["另一个显示路径"] }).targetCategoryId, 704);
  assert.equal(store.bindingForSource({ ...source, notebookId: "notebook-2" }), undefined);

  store.saveBinding(source, 705);
  store.resetMemoryCache();
  assert.equal(store.bindingForSource(source).targetCategoryId, 705);
  assert.equal(store.allBindings().length, 1);
  assert.ok(store.allBindings()[0].key);
  assert.equal(store.deleteBinding(store.allBindings()[0].key), true);
  assert.equal(store.bindingForSource(source), undefined);
  store.saveBinding(source, 705);
  assert.equal(store.clearBindings(), 1);
  assert.equal(store.bindingForSource(source), undefined);
});

test("408 绑定保留数学绑定，并在重新读取数据后保持独立", () => {
  const { context } = runtime();
  const store = context.__DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__;
  const source = { notebookId: "notebook-1", parentNoteId: "paper-2026", parentTitle: "2026" };
  store.saveBinding(source, 704);
  store.save408Binding(source, "https://www.408os.cn/exercise?year=2026&questionId=800");
  store.resetMemoryCache();
  assert.equal(store.bindingForSource(source).targetCategoryId, 704);
  assert.equal(store.binding408ForSource(source).targetURL, "https://www.408os.cn/exercise?year=2026");
  assert.equal(store.allBindings().length, 2);
  assert.equal(store.deleteBinding(store.allBindings().find((item) => item.provider === "408").key, "408"), true);
  assert.equal(store.binding408ForSource(source), undefined);
  assert.equal(store.bindingForSource(source).targetCategoryId, 704);
});

test("旧版数学绑定文件写入 408 绑定后仍可读取", () => {
  const { context, files } = runtime();
  const source = { notebookId: "notebook-1", parentNoteId: "paper-2026", parentTitle: "2026" };
  const key = "notebook-1\u001fpaper-2026";
  files.set("/documents/DaguanyuanBridge/category-mappings.json", { text: JSON.stringify({
    schemaVersion: 2,
    categoryBindings: { [key]: { ...source, targetCategoryId: 704 } },
  }) });
  const store = context.__DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__;
  store.save408Binding(source, "https://www.408os.cn/exercise?year=2026");
  store.resetMemoryCache();
  assert.equal(store.bindingForSource(source).targetCategoryId, 704);
  assert.equal(store.binding408ForSource(source).targetURL, "https://www.408os.cn/exercise?year=2026");
});

test("408 定位按绑定年份和父节点下的序号打开对应题目", () => {
  const { context } = runtime();
  const routes = context.__DAGUANYUAN_408_ROUTES_GLOBAL__;
  assert.equal(routes.questionURL("https://www.408os.cn/exercise?year=2026", 5), "https://www.408os.cn/exercise?year=2026&questionId=804");
  assert.equal(routes.questionURL("https://www.408os.cn/exercise?year=2026&questionId=800", 47), "https://www.408os.cn/exercise?year=2026&questionId=846");
  assert.throws(() => routes.questionURL("https://example.com/exercise?year=2026", 5), /408 网站/);
  assert.throws(() => routes.questionURL("https://www.408os.cn/exercise?year=2026", 48), /1—47/);
});

test("408 页绑定按钮读取当前网页地址并关联当前父节点", () => {
  const { context } = runtime();
  vm.runInContext(videoSource, context);
  let panelMethods;
  let message = "";
  context.JSB = { defineClass(name, methods) { panelMethods = methods; return { new() { return {}; } }; } };
  context.Application = { sharedInstance() { return { documentPath: "/documents", showHUD(value) { message = String(value); } }; } };
  context.__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__ = {
    currentCategorySource() { return { notebookId: "notebook-1", parentNoteId: "paper-2026", parentTitle: "2026" }; },
  };
  vm.runInContext(panelSource, context);
  context.self = {
    addon: { window: {} },
    currentContentPage: "408",
    webView: { evaluateJavaScript(script, callback) { callback("https://www.408os.cn/exercise?year=2026&questionId=800"); } },
  };
  const allowed = panelMethods.webViewShouldStartLoadWithRequestNavigationType(context.self.webView, {
    URL: { absoluteString: "daguanyuanbridge://bind-category" },
  });
  assert.equal(allowed, false);
  const binding = context.__DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__.binding408ForSource({ notebookId: "notebook-1", parentNoteId: "paper-2026" });
  assert.equal(binding.targetURL, "https://www.408os.cn/exercise?year=2026");
  assert.match(message, /已绑定：2026/);
});

test("题型导航开关控制网页内绑定按钮", () => {
  let panelMethods;
  const defaults = {};
  const injected = [];
  const context = {
    JSB: { defineClass(name, methods) { panelMethods = methods; return { new() { return {}; } }; } },
    NSUserDefaults: { standardUserDefaults() { return {
      objectForKey(key) { return defaults[key]; },
      setObjectForKey(value, key) { defaults[key] = value; },
    }; } },
    __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__: { bindCategoryScript(enabled) { return enabled ? "bind-on" : "bind-off"; } },
    Number, String, Array, Object, JSON, Math, RegExp, Error, console,
  };
  vm.createContext(context);
  vm.runInContext(panelSource, context);
  const controller = {
    activePage: "408",
    webView: { evaluateJavaScript(script, callback) { injected.push(script); callback(true, null); } },
    settingsPage: {}, categoryManagerPage: {}, bindCategorySwitch: {},
  };
  context.self = controller;
  panelMethods.toggleBindCategoryDisplay({ on: false });
  assert.equal(injected.at(-1), "bind-off");
  assert.equal(controller.bindCategorySwitch.on, false);
  controller.activePage = "math";
  panelMethods.toggleBindCategoryDisplay({ on: true });
  assert.equal(injected.at(-1), "bind-on");
  assert.equal(controller.bindCategorySwitch.on, true);
});

test("从大观园实时地址优先读取选中分类 ID", () => {
  const { context } = runtime();
  const routes = context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__;
  assert.equal(routes.categoryIdFromURL("https://www.cxyonly.fans/math/practice/321?resumeCategoryId=704"), 704);
  assert.equal(routes.categoryIdFromURL("https://www.cxyonly.fans/math/practice/321"), 321);
  assert.equal(routes.categoryIdFromURL("https://www.cxyonly.fans/math"), 0);
});

test("分类绑定由网页内按钮触发，保留原有绑定逻辑", () => {
  assert.doesNotMatch(panelSource, /controller\.bindCategoryButton/);
  assert.match(mainSource, /JSB\.require\("DaguanyuanWebsiteBridge"\)/);
  assert.match(panelSource, /bind-category/);
  assert.match(panelSource, /bindCurrentCategory: function/);
  assert.match(panelSource, /evaluateJavaScript\("String\(window\.location\.href \|\| ''\)"/);
  assert.match(panelSource, /clearCategoryBindings: function/);
  assert.doesNotMatch(panelSource, /mappingWebView/);
  assert.doesNotMatch(mainSource, /DaguanyuanCategoryMappingPage/);
  assert.equal(existsSync(new URL("../src/DaguanyuanCategoryMappingPage.js", import.meta.url)), false);
});

test("跳转优先读取当前父节点绑定，失败时保留数学页供用户手动选择", () => {
  assert.match(addonSource, /currentCategorySource\(self\)/);
  assert.match(addonSource, /bindingForSource\(source\)/);
  assert.match(addonSource, /prepareCategoryBinding\(\s*self\.panelController/);
  assert.doesNotMatch(addonSource, /openCategoryMapping|mappingForPath/);
});

test("设置页通过原生二级页面管理分类数据和人工绑定", () => {
  assert.match(panelSource, /controller\.settingsPage = new UIScrollView/);
  assert.match(panelSource, /controller\.settingsPage\.contentSize/);
  assert.match(panelSource, /categoryManageTitle = label\("题型分类管理"/);
  assert.match(panelSource, /categoryManageChevron = label\("›"/);
  assert.match(panelSource, /button\("", controller, "openCategoryManager:"\)/);
  assert.match(panelSource, /updateCategoryCatalog: function/);
  assert.match(panelSource, /deleteManagedBinding: function/);
  assert.match(managerSource, /label\("题型分类管理"/);
  assert.match(managerSource, /categoryManagerContentScroll = new UIScrollView/);
  assert.match(managerSource, /categoryBindingsCard = card\(\)/);
  assert.match(managerSource, /categoryManagerContentScroll\.contentSize/);
  assert.doesNotMatch(managerSource, /categoryBindingsScroll/);
  assert.match(managerSource, /button\("立即更新", controller, "updateCategoryCatalog:"\)/);
  assert.match(managerSource, /button\("清除全部绑定", controller, "clearCategoryBindings:"\)/);
  assert.doesNotMatch(panelSource, /分类匹配管理|保存并跳转|已保存的人工匹配/);
});
