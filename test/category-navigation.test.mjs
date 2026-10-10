import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const catalogSource = readFileSync(new URL("../src/DaguanyuanCategoryCatalog.js", import.meta.url), "utf8");
const routesSource = readFileSync(new URL("../src/DaguanyuanCategoryRoutes.js", import.meta.url), "utf8");
const resolverSource = readFileSync(new URL("../src/DaguanyuanQuestionResolver.js", import.meta.url), "utf8");
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

function panelTools() {
  const context = {
    JSB: { defineClass() { return { new() { return {}; } }; } },
    Number, String, Array, Object, JSON, Math, RegExp, Error, console,
  };
  vm.createContext(context);
  vm.runInContext(panelSource, context);
  return context.__DAGUANYUAN_WEB_PANEL_GLOBAL__;
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

test("题目定位根据同级序号生成分页地址和页内位置", () => {
  const routes = categoryRoutes();
  const result = routes.resultForCategoryId(346);
  const route = routes.questionRouteFor(result, 24);
  assert.equal(route.url, "https://www.cxyonly.fans/math/practice/321?resumeCategoryId=346");
  assert.equal(route.categoryId, 346);
  assert.equal(route.page, 2);
  assert.equal(route.indexOnPage, 4);
  assert.equal(route.questionNumber, 24);
  assert.equal(routes.questionRouteFor(result, 0), undefined);
});

function runQuestionLocator(route, initialCount, totalCount = initialCount) {
  const script = panelTools().questionLocatorScript(route);
  const scheduled = [];
  const attributes = {};
  const listeners = {};
  const scrolled = [];
  let count = initialCount;
  let loadMoreClicks = 0;
  const rows = Array.from({ length: totalCount }, (_, index) => ({
    scrollIntoView() { scrolled.push(index + 1); },
  }));
  const scroller = {
    scrollTop: 0, scrollHeight: 1200, clientHeight: 400,
    dispatchEvent() { count = Math.min(totalCount, count + 20); },
  };
  const loadMore = {
    disabled: false,
    textContent: "加载更多题目",
    click() { loadMoreClicks += 1; count = Math.min(totalCount, count + 20); },
  };
  const context = {
    document: {
      documentElement: {
        setAttribute(name, value) { attributes[name] = value; },
        addEventListener(name, listener) { listeners[name] = listener; },
      },
      querySelector(selector) {
        if (selector === '[class*="practiceScroll"]') return route.lazy ? scroller : null;
        if (selector === ".learning-shell__scope-toggle[data-scope]") {
          return { getAttribute() { return route.actualScope || route.scope; } };
        }
        return null;
      },
      querySelectorAll(selector) {
        if (selector === "[data-learning-question-id]") return rows.slice(0, count);
        if (selector === "button") return !route.lazy && count < totalCount ? [loadMore] : [];
        return [];
      },
    },
    window: { setTimeout(callback) { scheduled.push(callback); }, localStorage: { getItem() { return route.scope; } } },
    Event: function () {}, Number, String, Array, Object, Math, RegExp,
  };
  vm.runInNewContext(script, context);
  return {
    attributes, listeners, scrolled, scheduled, scroller,
    get loadMoreClicks() { return loadMoreClicks; },
    flush() { for (let attempt = 0; scheduled.length && attempt < 100; attempt += 1) scheduled.shift()(); },
  };
}

test("严选分类的第 2 张题卡直接定位严选列表第 2 题", () => {
  const result = runQuestionLocator({ questionNumber: 2, scope: "core" }, 3);
  assert.deepEqual(result.scrolled, [2]);
  assert.equal(result.loadMoreClicks, 0);
  assert.equal(result.scheduled.length, 0);
  assert.equal(result.attributes["data-daguanyuan-bridge-question-locator"], "success:2");
});

test("完整题库仍按当前分类的题卡序号直接定位", () => {
  const result = runQuestionLocator({ questionNumber: 2, scope: "complete" }, 3);
  assert.deepEqual(result.scrolled, [2]);
  assert.equal(result.loadMoreClicks, 0);
});

test("只在目标序号尚未加载时加载下一批题目", () => {
  const result = runQuestionLocator({ questionNumber: 38, scope: "core" }, 20, 40);
  result.flush();
  assert.equal(result.loadMoreClicks, 1);
  assert.deepEqual(result.scrolled, [38]);
  assert.equal(result.attributes["data-daguanyuan-bridge-question-locator"], "success:38");
});

test("无加载更多按钮时只为未加载的目标题目触发一次列表加载", () => {
  const result = runQuestionLocator({ questionNumber: 38, scope: "core", lazy: true }, 20, 40);
  result.flush();
  assert.equal(result.scroller.scrollTop, 800);
  assert.deepEqual(result.scrolled, [38]);
  assert.equal(result.attributes["data-daguanyuan-bridge-question-locator"], "success:38");
});

test("当前范围题目不足时停止，不持续向下滚动", () => {
  const result = runQuestionLocator({ questionNumber: 7, scope: "core" }, 3);
  result.flush();
  assert.deepEqual(result.scrolled, []);
  assert.equal(result.loadMoreClicks, 0);
  assert.equal(result.attributes["data-daguanyuan-bridge-question-locator"], "failed:7");
});

test("题库范围与点击时不一致时不误定位另一范围同序号题目", () => {
  const result = runQuestionLocator({ questionNumber: 2, scope: "core", actualScope: "complete" }, 3);
  result.flush();
  assert.deepEqual(result.scrolled, []);
  assert.equal(result.attributes["data-daguanyuan-bridge-question-locator"], "failed:2");
});

test("用户手动触摸列表后停止待完成的定位", () => {
  const result = runQuestionLocator({ questionNumber: 38, scope: "core" }, 20, 40);
  result.listeners.touchstart();
  result.flush();
  assert.deepEqual(result.scrolled, []);
  assert.equal(result.attributes["data-daguanyuan-bridge-question-locator"], "cancelled:38");
});

test("定位前读取网页当前严选范围，拒绝从其他网站猜测题库范围", () => {
  const context = {
    JSB: { defineClass() { return { new() { return {}; } }; } },
    __DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__: { importContextScript() { return "read-scope"; } },
    __DAGUANYUAN_MATH_API_GLOBAL__: {
      questionScope(value) { if (!["complete", "core", "exam"].includes(value)) throw new Error("范围无效"); return value; },
    },
    Number, String, Array, Object, JSON, Math, RegExp, Error, console,
  };
  vm.createContext(context);
  vm.runInContext(panelSource, context);
  const panel = context.__DAGUANYUAN_WEB_PANEL_GLOBAL__;
  let currentURL = "https://www.cxyonly.fans/math/practice/321";
  const controller = {
    currentContentPage: "math",
    webView: { evaluateJavaScript(script, completion) {
      assert.equal(script, "read-scope");
      completion(JSON.stringify({ url: currentURL, scope: "core" }), null);
    } },
  };
  let received;
  panel.currentQuestionScope(controller, (error, scope) => { received = { error, scope }; });
  assert.equal(received.error, null);
  assert.equal(received.scope, "core");
  currentURL = "https://www.408os.cn/exercise?year=2026";
  panel.currentQuestionScope(controller, (error, scope) => { received = { error, scope }; });
  assert.match(received.error.message, /请先在数学题库/);
});

test("原生网络层在打开网页前取得第 38 题的真实 ID", () => {
  let requestedURL = "";
  const context = {
    NSURL: { URLWithString(value) { requestedURL = String(value); return requestedURL; } },
    NSMutableURLRequest: {
      requestWithURL(url) {
        return {
          url,
          setHTTPMethod() {},
          setTimeoutInterval() {},
          setAllHTTPHeaderFields() {},
        };
      },
    },
    NSURLConnection: {
      sendAsynchronousRequestQueueCompletionHandler(request, queue, completion) {
        completion(
          { statusCode() { return 200; } },
          {
            length() { return 1; },
            payload: {
              code: 0,
              data: {
                total: 56,
                items: Array.from({ length: 20 }, (_, index) => ({ id: 3508 + index })),
              },
            },
          },
          null
        );
      },
    },
    NSOperationQueue: { mainQueue() { return {}; } },
    NSJSONSerialization: { JSONObjectWithDataOptions(data) { return data.payload; } },
    Number, String, Array, Object, JSON, Math, RegExp, Error,
    encodeURIComponent, console,
  };
  vm.createContext(context);
  vm.runInContext(resolverSource, context);
  let resolvedError;
  let resolvedRoute;
  context.__DAGUANYUAN_QUESTION_RESOLVER_GLOBAL__.resolve({
    url: "https://www.cxyonly.fans/math/practice/321?resumeCategoryId=704&page=2",
    categoryId: 704,
    page: 2,
    indexOnPage: 18,
    questionNumber: 38,
  }, function (error, route) {
    resolvedError = error;
    resolvedRoute = route;
  });
  assert.equal(resolvedError, null);
  assert.match(requestedURL, /\/api\/questions\?/);
  assert.match(requestedURL, /category_id=704/);
  assert.match(requestedURL, /page=2/);
  assert.equal(resolvedRoute.questionId, 3525);
  assert.equal(resolvedRoute.url, "https://www.cxyonly.fans/math/practice/321?resumeCategoryId=704");
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

test("题目导航提供定位开关并复用题型绑定和同级进度", () => {
  assert.match(panelSource, /controller\.questionNavigationSectionTitle = label\("题目导航"/);
  assert.match(panelSource, /controller\.questionLocatorTitle = label\("显示定位题目"/);
  assert.match(panelSource, /controller\.questionLocatorSwitch\.addTargetActionForControlEvents\(controller, "toggleQuestionLocator:"/);
  assert.match(coreSource, /question-navigation\.locator-enabled/);
  assert.match(coreSource, /currentQuestionContext/);
  assert.match(addonSource, /locateQuestion: function/);
  assert.match(addonSource, /bindingForSource\(source\)/);
  assert.match(addonSource, /questionRouteFor\(result, context\.progress\.index\)/);
  assert.doesNotMatch(addonSource, /__DAGUANYUAN_QUESTION_RESOLVER_GLOBAL__\.resolve\(route/);
  assert.match(panelSource, /openDaguanyuanQuestion\(controller, route\)/);
  assert.match(panelSource, /questionLocatorScript/);
  assert.match(panelSource, /加载更多题目/);
  assert.ok(mainSource.indexOf('JSB.require("DaguanyuanQuestionResolver")') < mainSource.indexOf('JSB.require("WebAddon")'));
});

test("普通题卡按已绑定分类和同级序号打开数学页面", () => {
  let openedRoute;
  const context = {
    JSB: {
      defineClass(name, methods) { return methods; },
    },
    __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__: {
      navigationNote() { return {}; },
      currentQuestionContext() {
        return {
          source: { notebookId: "notebook", parentNoteId: "parent", sourcePath: ["0/0"] },
          progress: { index: 38, total: 57 },
        };
      },
      showMessage() {},
    },
    __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__: {
      binding408ForSource() { return undefined; },
      bindingForSource() { return { targetCategoryId: 704 }; },
    },
    __DAGUANYUAN_CATEGORY_ROUTES_GLOBAL__: {
      resultForCategoryId() { return { status: "resolved", categoryId: 704, routeCategoryId: 321 }; },
      questionRouteFor() {
        return {
          url: "https://www.cxyonly.fans/math/practice/321?resumeCategoryId=704",
          categoryId: 704,
          page: 2,
          indexOnPage: 18,
          questionNumber: 38,
        };
      },
    },
    __DAGUANYUAN_WEB_PANEL_GLOBAL__: {
      openDaguanyuanQuestion(controller, route) { openedRoute = route; },
    },
    self: { panelController: {} },
    Number, String, Array, Object, JSON, Math, RegExp, Error, console,
  };
  vm.createContext(context);
  vm.runInContext(addonSource, context);
  const addon = context.createDaguanyuanBridgeAddon();
  addon.locateQuestion();
  assert.equal(openedRoute.questionNumber, 38);
  assert.equal(openedRoute.questionId, undefined);
  assert.equal(openedRoute.url, "https://www.cxyonly.fans/math/practice/321?resumeCategoryId=704");
});

test("408 绑定优先按父节点下的卡片序号定位，不调用数学题目解析", () => {
  let opened;
  const context = {
    JSB: { defineClass(name, methods) { return methods; } },
    __DAGUANYUAN_FOCUS_NEXT_CORE_GLOBAL__: {
      navigationNote() { return {}; },
      currentQuestionContext() {
        return { source: { notebookId: "notebook", parentNoteId: "year-2026" }, progress: { index: 5, total: 47 } };
      },
      showMessage() {},
    },
    __DAGUANYUAN_CATEGORY_MAPPING_STORE_GLOBAL__: {
      binding408ForSource() { return { targetURL: "https://www.408os.cn/exercise?year=2026" }; },
      bindingForSource() { throw new Error("不应查找数学绑定"); },
    },
    __DAGUANYUAN_WEB_PANEL_GLOBAL__: {
      open408Question(controller, url, number) { opened = { url, number }; },
    },
    self: { panelController: {} },
    Number, String, Array, Object, JSON, Math, RegExp, Error, console,
  };
  vm.createContext(context);
  vm.runInContext(addonSource, context);
  context.createDaguanyuanBridgeAddon().locateQuestion();
  assert.deepEqual(opened, { url: "https://www.408os.cn/exercise?year=2026", number: 5 });
});
