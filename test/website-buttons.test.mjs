import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/DaguanyuanWebsiteBridge.js", import.meta.url), "utf8");

function browser(hostname, pathname, search = "") {
  const timers = [];
  function element(tagName = "div", attributes = {}) {
    return {
      tagName: tagName.toUpperCase(), attributes, children: [], parentNode: null, handlers: {}, style: {},
      get firstChild() { return this.children[0] || null; },
      get previousElementSibling() {
        if (!this.parentNode) return null;
        return this.parentNode.children[this.parentNode.children.indexOf(this) - 1] || null;
      },
      get nextSibling() {
        if (!this.parentNode) return null;
        return this.parentNode.children[this.parentNode.children.indexOf(this) + 1] || null;
      },
      getAttribute(name) { return this.attributes[name] ?? null; },
      setAttribute(name, value) { this.attributes[name] = value; },
      appendChild(child) { child.parentNode = this; this.children.push(child); },
      insertBefore(child, sibling) {
        if (child.parentNode) child.parentNode.removeChild(child);
        child.parentNode = this;
        const index = this.children.indexOf(sibling);
        this.children.splice(index < 0 ? this.children.length : index, 0, child);
      },
      removeChild(child) { this.children = this.children.filter((item) => item !== child); child.parentNode = null; },
      matches(selector) { return selector === "article.question-document[data-question-id]" && this.tagName === "ARTICLE"; },
      closest(selector) {
        let node = this.parentNode;
        while (node) {
          if (selector === "[data-learning-question-id]" && node.getAttribute("data-learning-question-id")) return node;
          node = node.parentNode;
        }
        return null;
      },
      querySelector(selector) {
        if (selector === '[data-learning-question-card] > header > div:first-child') {
          const card = this.querySelector("[data-learning-question-card]");
          const header = card?.children.find((child) => child.tagName === "HEADER");
          return header?.children.find((child) => child.tagName === "DIV") || null;
        }
        const attribute = selector.match(/^\[([^\]]+)\]$/);
        for (const child of this.children) {
          if (selector.toUpperCase() === child.tagName) return child;
          if (selector === '[class*="chapterSelector"]' && String(child.getAttribute("class") || "").includes("chapterSelector")) return child;
          if (attribute && child.getAttribute(attribute[1]) !== null) return child;
          const nested = child.querySelector(selector);
          if (nested) return nested;
        }
        return null;
      },
      addEventListener(name, callback) { this.handlers[name] = callback; },
    };
  }
  const body = element("body");
  const main = element("main");
  body.appendChild(main);
  const practiceHeader = element("header", { "data-learning-question-practice-toolbar": "" });
  const contextBox = element("div", { "data-slot": "context" });
  const categorySelector = element("div", { "class": "chapterSelector" });
  contextBox.appendChild(categorySelector);
  practiceHeader.appendChild(contextBox);
  main.appendChild(practiceHeader);
  const exerciseHeader = element("header", { "class": "exercise-header" });
  const exerciseLeft = element("div", { "class": "header-left" });
  const modeSwitch = element("div", { "class": "mode-switch" });
  exerciseLeft.appendChild(element("button"));
  exerciseLeft.appendChild(element("h1"));
  exerciseLeft.appendChild(modeSwitch);
  exerciseHeader.appendChild(exerciseLeft);
  main.appendChild(exerciseHeader);
  const rows = [];
  const context = {
    window: {
      location: { hostname, pathname, search },
      setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
      addEventListener() {},
    },
    document: {
      documentElement: element("html"), body,
      createElement(tag) { return element(tag); },
      querySelector(selector) {
        if (selector === "main") return main;
        if (selector === '[role="main"]') return null;
        if (selector === '[data-learning-question-practice-toolbar] [data-slot="context"]') return contextBox;
        if (selector === ".exercise-header > .header-left") return exerciseLeft;
        return body.querySelector(selector);
      },
      querySelectorAll(selector) {
        return selector === "[data-learning-question-id], article.question-document[data-question-id]" ? rows : [];
      },
    },
    MutationObserver: class { observe() {} },
    Number, String, encodeURIComponent,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  function runSync() {
    const index = timers.findIndex((item) => item.delay === 80);
    assert.ok(index >= 0);
    timers.splice(index, 1)[0].callback();
  }
  return { context, body, main, contextBox, categorySelector, exerciseLeft, modeSwitch, rows, element, runSync };
}

test("数学题目页每题只插入一个定位卡片按钮并回传题目 ID", () => {
  const page = browser("www.cxyonly.fans", "/math/practice/855");
  const row = page.element("li", { "data-learning-question-id": "3356" });
  const card = page.element("article", { "data-learning-question-card": "" });
  const header = page.element("header");
  const metadata = page.element("div");
  const number = page.element("strong");
  const source = page.element("span");
  const article = page.element("article", { "data-question-id": "3356" });
  metadata.appendChild(number);
  metadata.appendChild(source);
  header.appendChild(metadata);
  card.appendChild(header);
  card.appendChild(article);
  row.appendChild(card);
  page.main.appendChild(row);
  page.rows.push(row, article);
  const script = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.practiceScript();
  vm.runInContext(script, page.context);
  page.runSync();
  const button = row.querySelector("[data-daguanyuan-practice-locate-card]");
  assert.equal(button?.textContent, "定位卡片");
  assert.deepEqual(metadata.children.map((child) => child.tagName), ["STRONG", "BUTTON", "SPAN"]);
  assert.equal(button.parentNode, metadata);
  assert.equal(article.querySelector("[data-daguanyuan-practice-locate-card]"), null);
  button.handlers.click.call(button, { preventDefault() {}, stopPropagation() {} });
  assert.equal(page.body.children.at(-1).src, "daguanyuanbridge://locate-card?id=3356");
  vm.runInContext(script, page.context);
  page.runSync();
  assert.equal(metadata.children.filter((child) => child.getAttribute("data-daguanyuan-practice-locate-card")).length, 1);
});

test("旧版题外按钮自动移入题序与来源之间并采用复测按钮尺寸", () => {
  const page = browser("cxyonly.fans", "/math/practice/855");
  const row = page.element("li", { "data-learning-question-id": "3356" });
  const card = page.element("article", { "data-learning-question-card": "" });
  const header = page.element("header");
  const metadata = page.element("div");
  const number = page.element("strong");
  const source = page.element("span");
  const oldButton = page.element("button", { "data-daguanyuan-practice-locate-card": "3356" });
  oldButton.style.cssText = "font-size:12px";
  metadata.appendChild(number);
  metadata.appendChild(source);
  header.appendChild(metadata);
  card.appendChild(header);
  row.appendChild(card);
  row.appendChild(oldButton);
  page.main.appendChild(row);
  page.rows.push(row);
  vm.runInContext(page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.practiceScript(), page.context);
  page.runSync();
  assert.equal(metadata.children[1], oldButton);
  assert.match(oldButton.style.cssText, /padding:5px 10px/);
  assert.match(oldButton.style.cssText, /font-size:12px/);
});

test("题目页定位卡片开关可即时隐藏并重新显示按钮", () => {
  const page = browser("cxyonly.fans", "/math/practice/855");
  const row = page.element("li", { "data-learning-question-id": "3356" });
  const card = page.element("article", { "data-learning-question-card": "" });
  const header = page.element("header");
  const metadata = page.element("div");
  metadata.appendChild(page.element("strong"));
  metadata.appendChild(page.element("span"));
  header.appendChild(metadata);
  card.appendChild(header);
  row.appendChild(card);
  page.main.appendChild(row);
  page.rows.push(row);
  const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(bridge.practiceScript(true), page.context);
  page.runSync();
  assert.ok(row.querySelector("[data-daguanyuan-practice-locate-card]"));
  vm.runInContext(bridge.practiceScript(false), page.context);
  page.runSync();
  assert.equal(row.querySelector("[data-daguanyuan-practice-locate-card]"), null);
  vm.runInContext(bridge.practiceScript(true), page.context);
  page.runSync();
  assert.ok(row.querySelector("[data-daguanyuan-practice-locate-card]"));
});

test("添加笔记按钮紧邻定位卡片且两个开关独立", () => {
  const page = browser("cxyonly.fans", "/math/practice/360");
  const row = page.element("li", { "data-learning-question-id": "4042" });
  const card = page.element("article", { "data-learning-question-card": "" });
  const header = page.element("header");
  const metadata = page.element("div");
  metadata.appendChild(page.element("strong"));
  metadata.appendChild(page.element("span"));
  header.appendChild(metadata);
  card.appendChild(header);
  row.appendChild(card);
  page.main.appendChild(row);
  page.rows.push(row);
  const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(bridge.practiceScript(true, true), page.context);
  page.runSync();
  const locate = row.querySelector("[data-daguanyuan-practice-locate-card]");
  const note = row.querySelector("[data-daguanyuan-practice-add-note]");
  assert.deepEqual(metadata.children.slice(0, 3), [metadata.children[0], locate, note]);
  assert.equal(note.textContent, "添加笔记");
  assert.equal(note.style.cssText, locate.style.cssText);
  note.handlers.click.call(note, { preventDefault() {}, stopPropagation() {} });
  assert.equal(page.body.children.at(-1).src, "daguanyuanbridge://add-note?id=4042");
  vm.runInContext(bridge.practiceScript(true, true), page.context);
  page.runSync();
  assert.equal(metadata.children.filter((item) => item.getAttribute("data-daguanyuan-practice-add-note")).length, 1);
  vm.runInContext(bridge.practiceScript(false, true), page.context);
  page.runSync();
  assert.equal(row.querySelector("[data-daguanyuan-practice-locate-card]"), null);
  assert.equal(metadata.children[1], note);
  vm.runInContext(bridge.practiceScript(true, false), page.context);
  page.runSync();
  assert.equal(row.querySelector("[data-daguanyuan-practice-add-note]"), null);
  assert.ok(row.querySelector("[data-daguanyuan-practice-locate-card]"));
});

test("数学与 408 的分类页显示网页内绑定按钮，设置关闭后移除", () => {
  for (const [host, path, search] of [
    ["cxyonly.fans", "/math/practice/855", "?resumeCategoryId=1035"],
    ["www.408os.cn", "/exercise", "?year=2026"],
  ]) {
    const page = browser(host, path, search);
    const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
    vm.runInContext(bridge.bindCategoryScript(true), page.context);
    page.runSync();
    const toolbar = page.main.querySelector("[data-daguanyuan-bind-category-wrap]");
    assert.equal(toolbar?.children[0].textContent, "绑定当前分类");
    if (host.includes("cxyonly")) {
      assert.equal(toolbar.parentNode, page.contextBox);
      assert.equal(toolbar.previousElementSibling, page.categorySelector);
    } else {
      assert.equal(toolbar.parentNode, page.exerciseLeft);
      assert.equal(toolbar.previousElementSibling, page.modeSwitch);
    }
    const button = toolbar.children[0];
    button.handlers.click.call(button, { preventDefault() {}, stopPropagation() {} });
    assert.equal(page.body.children.at(-1).src, "daguanyuanbridge://bind-category");
    vm.runInContext(bridge.bindCategoryScript(false), page.context);
    page.runSync();
    assert.equal(page.main.querySelector("[data-daguanyuan-bind-category-wrap]"), null);
    if (host.includes("cxyonly")) assert.equal(page.contextBox.style.display, undefined);
  }
});

test("旧版页顶绑定按钮升级后显示在分类下拉框右侧", () => {
  const page = browser("cxyonly.fans", "/math/practice/855");
  const toolbar = page.element("div", { "data-daguanyuan-bind-category-wrap": "" });
  toolbar.appendChild(page.element("button"));
  page.main.insertBefore(toolbar, page.main.firstChild);
  const oldState = { timer: null, schedule() {} };
  page.context.window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__ = oldState;
  vm.runInContext(page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.bindCategoryScript(true), page.context);
  page.runSync();
  const current = page.main.querySelector("[data-daguanyuan-bind-category-wrap]");
  assert.notEqual(current, toolbar);
  assert.equal(current.parentNode, page.contextBox);
  assert.equal(current.previousElementSibling, page.categorySelector);
  assert.equal(oldState.timer, -1);
});

test("数学分类导入按钮在绑定按钮右侧，两个开关独立", () => {
  const page = browser("cxyonly.fans", "/math/practice/1035");
  const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(bridge.bindCategoryScript(true, true), page.context);
  page.runSync();
  let toolbar = page.main.querySelector("[data-daguanyuan-bind-category-wrap]");
  assert.deepEqual(toolbar.children.map((item) => item.textContent), ["绑定当前分类", "导入当前题目"]);
  assert.equal(toolbar.children[0].style.cssText, toolbar.children[1].style.cssText);
  const importButton = toolbar.children[1];
  importButton.handlers.click.call(importButton, { preventDefault() {}, stopPropagation() {} });
  assert.equal(page.body.children.at(-1).src, "daguanyuanbridge://import-category");
  assert.equal(importButton.disabled, true);
  assert.equal(importButton.textContent, "导入中…");
  page.context.window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__.finishImport();
  page.runSync();
  assert.equal(importButton.disabled, false);
  vm.runInContext(bridge.bindCategoryScript(false, true), page.context);
  page.runSync();
  toolbar = page.main.querySelector("[data-daguanyuan-bind-category-wrap]");
  assert.deepEqual(toolbar.children.map((item) => item.textContent), ["导入当前题目"]);
  vm.runInContext(bridge.bindCategoryScript(true, false), page.context);
  page.runSync();
  assert.deepEqual(toolbar.children.map((item) => item.textContent), ["绑定当前分类"]);
});

test("分类导入在侧栏收起时读取网站保存的严选范围", () => {
  const context = {
    window: {
      location: { href: "https://www.cxyonly.fans/math/practice/345" },
      localStorage: { getItem(key) { assert.equal(key, "daguan:question-bank-scope"); return "core"; } },
    },
    document: { querySelector() { return { getAttribute() { return "core"; } }; } },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const bridge = context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  const captured = JSON.parse(vm.runInContext(bridge.importContextScript(), context));
  assert.equal(captured.url, "https://www.cxyonly.fans/math/practice/345");
  assert.equal(captured.scope, "core");
  context.document.querySelector = () => null;
  assert.equal(JSON.parse(vm.runInContext(bridge.importContextScript(), context)).scope, "core");
  context.window.localStorage.getItem = () => null;
  assert.equal(JSON.parse(vm.runInContext(bridge.importContextScript(), context)).scope, "complete");
  context.window.localStorage.getItem = () => "exam";
  assert.equal(JSON.parse(vm.runInContext(bridge.importContextScript(), context)).scope, "exam");
  context.window.localStorage.getItem = () => { throw new Error("Storage blocked"); };
  assert.equal(JSON.parse(vm.runInContext(bridge.importContextScript(), context)).scope, "");
});

test("408 年份页在模式图标右侧显示导入按钮，样式与数学一致", () => {
  const page = browser("www.408os.cn", "/exercise", "?year=2026");
  const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(bridge.bindCategoryScript(true, true), page.context);
  page.runSync();
  const toolbar = page.main.querySelector("[data-daguanyuan-bind-category-wrap]");
  assert.deepEqual(toolbar.children.map((item) => item.textContent), ["绑定当前分类", "导入当前题目"]);
  assert.equal(toolbar.previousElementSibling, page.modeSwitch);
  assert.equal(toolbar.parentNode, page.exerciseLeft);
  assert.equal(toolbar.children[0].style.cssText, toolbar.children[1].style.cssText);
  const button = toolbar.children[1];
  button.handlers.click.call(button, { preventDefault() {}, stopPropagation() {} });
  assert.equal(page.body.children.at(-1).src, "daguanyuanbridge://import-category");
  assert.equal(button.disabled, true);
  page.context.window.__DAGUANYUAN_BIND_CATEGORY_BUTTON__.finishImport();
  page.runSync();
  assert.equal(button.disabled, false);
  vm.runInContext(bridge.bindCategoryScript(false, false), page.context);
  page.runSync();
  assert.equal(page.main.querySelector("[data-daguanyuan-bind-category-wrap]"), null);
});

test("408 知识点分类即使没有年份参数也能显示整类导入按钮", () => {
  const page = browser("www.408os.cn", "/exercise", "?knowledgeId=125&knowledgeName=浮点数");
  const bridge = page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__;
  vm.runInContext(bridge.bindCategoryScript(true, true), page.context);
  page.runSync();
  const toolbar = page.main.querySelector("[data-daguanyuan-bind-category-wrap]");
  assert.deepEqual(toolbar.children.map((item) => item.textContent), ["导入当前题目"]);
  assert.equal(toolbar.previousElementSibling, page.modeSwitch);
  assert.equal(toolbar.children[0].title, "导入当前分类的全部题目");
  vm.runInContext(bridge.bindCategoryScript(true, false), page.context);
  page.runSync();
  assert.equal(page.main.querySelector("[data-daguanyuan-bind-category-wrap]"), null);
});

test("408 总览和数学首页不显示分类绑定按钮", () => {
  for (const [host, path] of [
    ["cxyonly.fans", "/math"],
    ["www.408os.cn", "/overview"],
  ]) {
    const page = browser(host, path);
    vm.runInContext(page.context.__DAGUANYUAN_WEBSITE_BRIDGE_GLOBAL__.bindCategoryScript(true), page.context);
    page.runSync();
    assert.equal(page.main.querySelector("[data-daguanyuan-bind-category-wrap]"), null);
  }
});
