import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";

const catalogSource = readFileSync(new URL("../src/DaguanyuanCategoryCatalog.js", import.meta.url), "utf8");
const catalogStoreSource = readFileSync(new URL("../src/DaguanyuanCategoryCatalogStore.js", import.meta.url), "utf8");
const routesSource = readFileSync(new URL("../src/DaguanyuanCategoryRoutes.js", import.meta.url), "utf8");
const storeSource = readFileSync(new URL("../src/DaguanyuanCategoryMappingStore.js", import.meta.url), "utf8");
const managerSource = readFileSync(new URL("../src/DaguanyuanCategoryManagerUI.js", import.meta.url), "utf8");
const addonSource = readFileSync(new URL("../src/WebAddon.js", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");
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
  vm.runInContext(catalogSource, context);
  vm.runInContext(catalogStoreSource, context);
  vm.runInContext(routesSource, context);
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

test("从大观园实时地址优先读取选中分类 ID", () => {
  const { context } = runtime();
  const routes = context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__;
  assert.equal(routes.categoryIdFromURL("https://www.cxyonly.fans/math/practice/321?resumeCategoryId=704"), 704);
  assert.equal(routes.categoryIdFromURL("https://www.cxyonly.fans/math/practice/321"), 321);
  assert.equal(routes.categoryIdFromURL("https://www.cxyonly.fans/math"), 0);
});

test("大观园页使用原生绑定按钮，不再依赖失效的网页 Bridge", () => {
  assert.match(panelSource, /bindCategoryButton/);
  assert.match(panelSource, /button\("绑定当前分类", controller, "bindCurrentCategory:"\)/);
  assert.match(panelSource, /x: Math\.min\(368, Math\.max\(20, bounds\.width - 132\)\)/);
  assert.match(panelSource, /bindCurrentCategory: function/);
  assert.match(panelSource, /evaluateJavaScript\("String\(window\.location\.href \|\| ''\)"/);
  assert.match(panelSource, /clearCategoryBindings: function/);
  assert.doesNotMatch(panelSource, /mappingWebView|webViewShouldStartLoadWithRequestNavigationType|daguanyuanbridge/);
  assert.doesNotMatch(mainSource, /DaguanyuanCategoryMappingPage|WebBridgeCommands/);
  assert.equal(existsSync(new URL("../src/DaguanyuanCategoryMappingPage.js", import.meta.url)), false);
  assert.equal(existsSync(new URL("../src/WebBridgeCommands.js", import.meta.url)), false);
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
