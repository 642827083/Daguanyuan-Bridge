import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const catalogSource = readFileSync(new URL("../src/DaguanyuanCategoryCatalog.js", import.meta.url), "utf8");
const routesSource = readFileSync(new URL("../src/DaguanyuanCategoryRoutes.js", import.meta.url), "utf8");
const coreSource = readFileSync(new URL("../src/DaguanyuanFocusNextCore.js", import.meta.url), "utf8");
const uiSource = readFileSync(new URL("../src/DaguanyuanFocusNextUI.js", import.meta.url), "utf8");
const addonSource = readFileSync(new URL("../src/WebAddon.js", import.meta.url), "utf8");
const panelSource = readFileSync(new URL("../src/WebPanelController.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

function categoryRoutes() {
  const context = { Number, String, Array, Object, JSON, Math, RegExp, console };
  vm.createContext(context);
  vm.runInContext(catalogSource, context);
  vm.runInContext(routesSource, context);
  return context.__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__;
}

test("本地分类快照包含完整公开分类树", () => {
  const routes = categoryRoutes();
  assert.equal(routes.size, 1061);
  assert.match(routes.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
});

test("完整路径忽略额外根节点和章节编号并生成分类直达地址", () => {
  const routes = categoryRoutes();
  const result = routes.resolve([
    "大观园源文件",
    "高等数学",
    "（一）极限",
    "函数",
    "函数性质考察",
    "有界",
  ]);
  assert.equal(result.status, "resolved");
  assert.equal(result.categoryId, 346);
  assert.equal(result.routeCategoryId, 321);
  assert.equal(routes.urlFor(result), "https://www.cxyonly.fans/math/practice/321?resumeCategoryId=346");
});

test("路径不足以区分同名分类时拒绝猜测", () => {
  const routes = categoryRoutes();
  const result = routes.resolve(["其他"]);
  assert.equal(result.status, "ambiguous");
  assert.ok(result.candidates.length > 1);
  assert.equal(routes.resolve(["不存在的题型分类"]).status, "missing");
});

test("核心模块从题卡直属父节点向上收集完整分类路径", () => {
  const context = {
    Application: { sharedInstance() { return { studyController() {} }; } },
    NSUserDefaults: { standardUserDefaults() { return { objectForKey() {}, setObjectForKey() {} }; } },
    Number, String, Array, Object, console,
  };
  vm.createContext(context);
  vm.runInContext(coreSource, context);
  const root = { noteId: "root", noteTitle: "高等数学" };
  const chapter = { noteId: "chapter", noteTitle: "（一）极限", parentNote: root };
  const category = { noteId: "category", noteTitle: "函数", parentNote: chapter };
  const question = { noteId: "question", noteTitle: "题目", parentNote: category };
  assert.deepEqual(Array.from(context.__DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__.categoryPath(question)), ["高等数学", "（一）极限", "函数"]);
});

test("设置页拆分题型导航大类并提供默认关闭的快捷跳转开关", () => {
  assert.match(panelSource, /controller\.categorySettingsSection = new UIView/);
  assert.match(panelSource, /controller\.categorySectionTitle = label\("题型导航"/);
  assert.match(panelSource, /controller\.categoryJumpTitle = label\("题型分类快捷跳转"/);
  assert.match(panelSource, /controller\.categoryJumpSwitch\.addTargetActionForControlEvents\(controller, "toggleCategoryJump:"/);
  assert.match(panelSource, /toggleCategoryJump: function/);
  assert.match(coreSource, /category-jump-enabled/);
  assert.match(coreSource, /if \(value === undefined \|\| value === null\) return false/);
});

test("题型按钮点击通过独立路由模块在插件面板中打开分类", () => {
  assert.match(mainSource, /JSB\.require\("DaguanyuanCategoryCatalog"\)/);
  assert.match(mainSource, /JSB\.require\("DaguanyuanCategoryRoutes"\)/);
  assert.match(uiSource, /action: "openFocusCategory:"/);
  assert.match(addonSource, /openFocusCategory: function/);
  assert.match(addonSource, /currentCategorySource\(self\)/);
  assert.match(addonSource, /bindingForSource\(source\)/);
  assert.match(addonSource, /__DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__\.resolve\(source\.sourcePath\)/);
  assert.match(panelSource, /openDaguanyuanCategory\(controller, urlString\)/);
});
